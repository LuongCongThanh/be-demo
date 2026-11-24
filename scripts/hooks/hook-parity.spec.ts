import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

// Every agent must reach the same hook outcome for the same action (ADR 0014).
// Each scenario is written in every agent's payload shape and run through the
// hooks that agent's own registry selects for that tool.
//
// Limitation: the Codex and Copilot payload shapes and Codex's `apply_patch`
// matcher aliases below come from the vendors' hook documentation and have not
// yet been confirmed by capturing a live session. Update them if a capture differs.

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

type Agent = 'claude' | 'codex' | 'copilot';
type Event = 'PreToolUse' | 'PostToolUse';
type Registration = { matcher?: string; hooks: Array<{ command: string }> };
type Registry = { hooks: Partial<Record<Event, Registration[]>> };
type Outcome = 'block' | 'allow' | 'remind';
type ToolCall = { toolName: string; payload: unknown };

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

const AGENTS: Agent[] = ['claude', 'codex', 'copilot'];

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

function outcome(agent: Agent, event: Event, { toolName, payload }: ToolCall): Outcome {
  let reminded = false;
  for (const command of hookCommands(agent, event, toolName)) {
    const result = spawnSync('bash', ['-c', command], {
      cwd: repoRoot,
      encoding: 'utf8',
      env: { ...process.env, SKIP_PR_VERIFY: '1', ...FEATURE_BRANCH_GIT_ENV },
      input: JSON.stringify({ hook_event_name: event, cwd: repoRoot, ...(payload as object) }),
    });
    if (result.status === 2 || isDenyOutput(result.stdout)) return 'block';
    // Any other failure is a broken hook, not an "allow": fail the scenario loudly.
    if (result.status !== 0) {
      throw new Error(`${agent} hook \`${command}\` exited ${result.status}: ${result.stderr}`);
    }
    if (result.stdout.includes('additionalContext')) reminded = true;
  }
  return reminded ? 'remind' : 'allow';
}

function shell(command: string): ToolCall {
  return { toolName: 'Bash', payload: { tool_name: 'Bash', tool_input: { command } } };
}

// Codex may touch several files in one patch; other agents edit one file per call.
function edit(agent: Agent, ...filePaths: string[]): ToolCall {
  if (agent === 'codex') {
    const patch = [
      '*** Begin Patch',
      ...filePaths.flatMap((path) => [`*** Update File: ${path}`, '@@', '-old', '+new']),
      '*** End Patch',
    ].join('\n');
    return { toolName: 'apply_patch', payload: { tool_name: 'apply_patch', tool_input: { command: patch } } };
  }
  const filePath = filePaths[filePaths.length - 1];
  if (agent === 'copilot') {
    return { toolName: 'Edit', payload: { tool_name: 'Edit', tool_input: { filePath } } };
  }
  return { toolName: 'Edit', payload: { tool_name: 'Edit', tool_input: { file_path: filePath } } };
}

const fixtureDir = mkdtempSync(join(tmpdir(), 'hook-parity-'));
afterAll(() => rmSync(fixtureDir, { recursive: true, force: true }));

// The git-workflow hook blocks every commit/push while the checkout is on a
// protected branch, so CI on a push to `dev` would see `block` where a feature
// branch sees `allow`. Pin the branch the hooks observe: GIT_DIR points at a
// throwaway repo on `chore/test`, GIT_WORK_TREE keeps the real repository files.
const featureBranchRepo = join(fixtureDir, 'feature-branch-repo');
// Git hooks (e.g. pre-push from a linked worktree) export GIT_DIR; drop it so
// the fixture repo is created where intended.
const gitEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
for (const args of [
  ['init', '-q', '-b', 'chore/test', featureBranchRepo],
  [
    '-C',
    featureBranchRepo,
    '-c',
    'user.name=hook-parity',
    '-c',
    'user.email=hook-parity@example.com',
    '-c',
    'commit.gpgsign=false',
    'commit',
    '-q',
    '--allow-empty',
    '-m',
    'init',
  ],
]) {
  const result = spawnSync('git', args, { encoding: 'utf8', env: gitEnv });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
}
const FEATURE_BRANCH_GIT_ENV = { GIT_DIR: join(featureBranchRepo, '.git'), GIT_WORK_TREE: repoRoot };

const controllerWithoutSummary = join(fixtureDir, 'widgets.controller.ts');
writeFileSync(
  controllerWithoutSummary,
  "@Controller('widgets')\nexport class WidgetsController {\n  @Get()\n  list() {}\n}\n",
);

const bodyWithTemplate = join(fixtureDir, 'body.md');
writeFileSync(
  bodyWithTemplate,
  readFileSync(resolve(repoRoot, '.github/pull_request_template.md'), 'utf8')
    .replace('- [ ] chore', '- [x] chore')
    .replace('- [ ] Code review:', '- [x] Code review: 0 findings'),
);

type Scenario = { name: string; expected: Outcome; build: (agent: Agent) => ToolCall };

const PRE_TOOL_SCENARIOS: Scenario[] = [
  { name: 'edit a secret .env file', expected: 'block', build: (agent) => edit(agent, '.env') },
  { name: 'edit .env.production', expected: 'block', build: (agent) => edit(agent, 'config/.env.production') },
  { name: 'edit a file inside .git/', expected: 'block', build: (agent) => edit(agent, '.git/config') },
  {
    name: 'edit an absolute path inside .git/',
    expected: 'block',
    build: (agent) => edit(agent, `${repoRoot}.git/HEAD`),
  },
  {
    name: 'edit a source file and .env together',
    expected: 'block',
    build: (agent) => edit(agent, 'src/main.ts', '.env'),
  },
  { name: 'edit .env.example', expected: 'allow', build: (agent) => edit(agent, '.env.example') },
  { name: 'edit a source file', expected: 'allow', build: (agent) => edit(agent, 'src/main.ts') },
  { name: 'force push', expected: 'block', build: () => shell('git push --force origin chore/test') },
  { name: 'push to dev via refspec', expected: 'block', build: () => shell('git push origin HEAD:dev') },
  { name: 'add a git worktree', expected: 'block', build: () => shell('git worktree add ../x') },
  { name: 'create a PR with --fill', expected: 'block', build: () => shell('gh pr create --base dev --fill') },
  {
    name: 'create a PR without a body',
    expected: 'block',
    build: () => shell('gh pr create --base dev --title "chore: test"'),
  },
  {
    name: 'create a PR with a template-shaped body',
    expected: 'allow',
    build: () => shell(`gh pr create --base dev --title "chore: test" --body-file "${bodyWithTemplate}"`),
  },
  { name: 'read-only shell command', expected: 'allow', build: () => shell('git status --short') },
  {
    name: 'force-with-lease push',
    expected: 'allow',
    build: () => shell('git push --force-with-lease origin chore/test'),
  },
];

const POST_TOOL_SCENARIOS: Scenario[] = [
  {
    name: 'edited controller lacks @ApiOperation',
    expected: 'remind',
    build: (agent) => edit(agent, controllerWithoutSummary),
  },
  { name: 'edited file needs no Swagger reminder', expected: 'allow', build: (agent) => edit(agent, 'README.md') },
  {
    name: 'a PR was just created',
    expected: 'remind',
    build: () => shell(`gh pr create --base dev --title "chore: test" --body-file "${bodyWithTemplate}"`),
  },
];

function outcomesFor(event: Event, build: Scenario['build']) {
  return Object.fromEntries(AGENTS.map((agent) => [agent, outcome(agent, event, build(agent))]));
}

describe('hook outcomes are identical across agents', () => {
  it.each(PRE_TOOL_SCENARIOS)('before: $name → $expected for every agent', ({ build, expected }) => {
    expect(outcomesFor('PreToolUse', build)).toEqual({ claude: expected, codex: expected, copilot: expected });
  });

  it.each(POST_TOOL_SCENARIOS)('after: $name → $expected for every agent', ({ build, expected }) => {
    expect(outcomesFor('PostToolUse', build)).toEqual({ claude: expected, codex: expected, copilot: expected });
  });

  it('every agent registers pre- and post-tool hooks for shell commands and file edits', () => {
    for (const agent of AGENTS) {
      for (const event of ['PreToolUse', 'PostToolUse'] as const) {
        expect(hookCommands(agent, event, shell('x').toolName).length).toBeGreaterThan(0);
        expect(hookCommands(agent, event, edit(agent, 'x').toolName).length).toBeGreaterThan(0);
      }
    }
  });
});
