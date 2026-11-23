import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Every agent must reach the same allow/block decision for the same action
// (ADR 0014). Each scenario is written in every agent's native payload shape and
// run through the hooks that agent's own registry selects for that tool.

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

type Agent = 'claude' | 'codex' | 'copilot';
type Event = 'PreToolUse' | 'PostToolUse';
type Registration = { matcher?: string; hooks: Array<{ command: string }> };
type Registry = { hooks: Partial<Record<Event, Registration[]>> };

// Copilot in VS Code reads the repository `.claude/settings.json` through its
// Claude-compatible PascalCase events (snake_case payload, Claude tool names),
// so it shares Claude's registry. Codex has its own registry and hook mirror.
const REGISTRIES: Record<Agent, string> = {
  claude: '.claude/settings.json',
  codex: '.codex/hooks.json',
  copilot: '.claude/settings.json',
};

// Codex reports file edits as `apply_patch`; `Edit` and `Write` are matcher aliases for it.
const MATCHER_ALIASES: Record<Agent, Record<string, string[]>> = {
  claude: {},
  codex: { apply_patch: ['apply_patch', 'Edit', 'Write'] },
  copilot: {},
};

function matches(agent: Agent, matcher: string | undefined, toolName: string) {
  if (!matcher || matcher === '*') return true;
  const pattern = new RegExp(`^(?:${matcher})$`);
  const names = MATCHER_ALIASES[agent][toolName] ?? [toolName];
  return names.some((name) => pattern.test(name));
}

function hookCommands(agent: Agent, event: Event, toolName: string) {
  const registry: Registry = JSON.parse(readFileSync(resolve(repoRoot, REGISTRIES[agent]), 'utf8'));
  return (registry.hooks[event] ?? [])
    .filter((registration) => matches(agent, registration.matcher, toolName))
    .flatMap((registration) => registration.hooks.map((hook) => hook.command));
}

type Decision = 'block' | 'allow';

function isDenyOutput(stdout: string) {
  for (const line of stdout.split('\n')) {
    try {
      const output = JSON.parse(line);
      if (
        output?.permissionDecision === 'deny' ||
        output?.hookSpecificOutput?.permissionDecision === 'deny' ||
        output?.decision === 'block'
      ) {
        return true;
      }
    } catch {
      // Non-JSON output is informational.
    }
  }
  return false;
}

function decide(agent: Agent, event: Event, toolName: string, payload: unknown): Decision {
  const commands = hookCommands(agent, event, toolName);
  for (const command of commands) {
    const result = spawnSync('bash', ['-c', command], {
      cwd: repoRoot,
      encoding: 'utf8',
      env: { ...process.env, SKIP_PR_VERIFY: '1' },
      input: JSON.stringify({ hook_event_name: event, cwd: repoRoot, ...(payload as object) }),
    });
    if (result.status === 2 || isDenyOutput(result.stdout)) return 'block';
  }
  return 'allow';
}

function shell(agent: Agent, command: string) {
  const toolName = 'Bash';
  return { toolName, payload: { tool_name: toolName, tool_input: { command } } };
}

function edit(agent: Agent, filePath: string) {
  if (agent === 'codex') {
    const patch = ['*** Begin Patch', `*** Update File: ${filePath}`, '@@', '-old', '+new', '*** End Patch'].join('\n');
    return { toolName: 'apply_patch', payload: { tool_name: 'apply_patch', tool_input: { command: patch } } };
  }
  if (agent === 'copilot') {
    return { toolName: 'Edit', payload: { tool_name: 'Edit', tool_input: { filePath } } };
  }
  return { toolName: 'Edit', payload: { tool_name: 'Edit', tool_input: { file_path: filePath } } };
}

const AGENTS: Agent[] = ['claude', 'codex', 'copilot'];

const SCENARIOS: Array<{
  name: string;
  expected: Decision;
  build: (agent: Agent) => { toolName: string; payload: unknown };
}> = [
  { name: 'edit a secret .env file', expected: 'block', build: (agent) => edit(agent, '.env') },
  { name: 'edit .env.production', expected: 'block', build: (agent) => edit(agent, 'config/.env.production') },
  { name: 'edit a file inside .git/', expected: 'block', build: (agent) => edit(agent, '.git/config') },
  { name: 'edit .env.example', expected: 'allow', build: (agent) => edit(agent, '.env.example') },
  { name: 'edit a source file', expected: 'allow', build: (agent) => edit(agent, 'src/main.ts') },
  {
    name: 'force push',
    expected: 'block',
    build: (agent) => shell(agent, 'git push --force origin chore/test'),
  },
  {
    name: 'push to dev via refspec',
    expected: 'block',
    build: (agent) => shell(agent, 'git push origin HEAD:dev'),
  },
  { name: 'add a git worktree', expected: 'block', build: (agent) => shell(agent, 'git worktree add ../x') },
  {
    name: 'create a PR with --fill',
    expected: 'block',
    build: (agent) => shell(agent, 'gh pr create --base dev --fill'),
  },
  { name: 'read-only shell command', expected: 'allow', build: (agent) => shell(agent, 'git status --short') },
  {
    name: 'force-with-lease push',
    expected: 'allow',
    build: (agent) => shell(agent, 'git push --force-with-lease origin chore/test'),
  },
];

describe('hook decisions are identical across agents', () => {
  it.each(SCENARIOS)('$name → $expected for every agent', ({ build, expected }) => {
    const decisions = Object.fromEntries(
      AGENTS.map((agent) => {
        const { toolName, payload } = build(agent);
        return [agent, decide(agent, 'PreToolUse', toolName, payload)];
      }),
    );

    expect(decisions).toEqual({ claude: expected, codex: expected, copilot: expected });
  });

  it('every agent registers a pre-tool hook for both shell commands and file edits', () => {
    for (const agent of AGENTS) {
      expect(hookCommands(agent, 'PreToolUse', shell(agent, 'x').toolName).length).toBeGreaterThan(0);
      expect(hookCommands(agent, 'PreToolUse', edit(agent, 'x').toolName).length).toBeGreaterThan(0);
    }
  });
});
