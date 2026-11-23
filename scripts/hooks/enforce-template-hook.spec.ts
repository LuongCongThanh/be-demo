import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

function runHook(hookPath: string, payload: unknown) {
  return spawnSync('bash', [resolve(repoRoot, hookPath)], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, SKIP_PR_VERIFY: '1' },
    input: JSON.stringify(payload),
  });
}

function copilotPayload(command: string) {
  return {
    sessionId: 'test',
    cwd: repoRoot,
    toolCalls: [{ id: 'test-call', name: 'bash', args: { command } }],
  };
}

describe('Copilot-compatible command hooks', () => {
  it('accepts a Claude tool_input command payload', () => {
    const result = runHook('.claude/hooks/enforce-pr-template.sh', {
      tool_input: { command: 'git status --short --branch' },
    });

    expect(result.status).toBe(0);
    expect(result.stderr).not.toContain('No Bash command');
  });

  it('fails closed for a whitespace-only Claude tool_input command', () => {
    const result = runHook('.claude/hooks/enforce-pr-template.sh', { tool_input: { command: '   ' } });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('No Bash command');
  });

  it('fails closed for a whitespace-only Copilot Bash command', () => {
    const result = runHook('.claude/hooks/enforce-pr-template.sh', copilotPayload('   '));

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('A Bash tool call is missing its command');
  });

  it.each(['.claude/hooks/enforce-pr-template.sh', '.codex/hooks/enforce-pr-template.sh'])(
    '%s blocks PR creation with an unvalidated stdin body',
    (hookPath) => {
      const result = runHook(
        hookPath,
        copilotPayload('cd be-demo && gh pr create --base dev --title "docs: test" --body-file -'),
      );

      expect(result.status).toBe(2);
      expect(result.stderr).toContain('--body-file -');
    },
  );

  it('accepts a complete template body from a Copilot tool payload', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'pr-template-hook-'));
    const bodyPath = join(tempDir, 'body.md');
    const body = readFileSync(resolve(repoRoot, '.github/pull_request_template.md'), 'utf8')
      .replace('- [ ] docs', '- [x] docs')
      .replace('- [ ] Code review:', '- [x] Code review: 0 findings');

    try {
      writeFileSync(bodyPath, body);
      const result = runHook(
        '.claude/hooks/enforce-pr-template.sh',
        copilotPayload(`gh pr create --base dev --title "docs: test" --body-file "${bodyPath}"`),
      );

      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('rejects a code-review outcome misplaced outside Verification', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'pr-template-hook-'));
    const bodyPath = join(tempDir, 'body.md');
    const body = readFileSync(resolve(repoRoot, '.github/pull_request_template.md'), 'utf8')
      .replace('- [ ] docs', '- [x] docs')
      .replace('- [ ] Code review:', '- [ ] Code review:')
      .replace('## 6. Reviewer Notes', '## 6. Reviewer Notes\n\n- [x] Code review: 0 findings');

    try {
      writeFileSync(bodyPath, body);
      const result = runHook(
        '.claude/hooks/enforce-pr-template.sh',
        copilotPayload(`gh pr create --base dev --title "docs: test" --body-file "${bodyPath}"`),
      );

      expect(result.status).toBe(2);
      expect(result.stderr).toMatch(/Code review|code-review|Verification/i);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('accepts a CRLF template body', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'pr-template-hook-'));
    const bodyPath = join(tempDir, 'body.md');
    const body = readFileSync(resolve(repoRoot, '.github/pull_request_template.md'), 'utf8')
      .replace('- [ ] docs', '- [x] docs')
      .replace('- [ ] Code review:', '- [x] Code review: 0 findings')
      .replace(/\n/g, '\r\n');

    try {
      writeFileSync(bodyPath, body);
      const result = runHook(
        '.claude/hooks/enforce-pr-template.sh',
        copilotPayload(`gh pr create --base dev --title "docs: test" --body-file "${bodyPath}"`),
      );

      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it.each(['- [ ] Code review: 0 findings', '- [x] Code review: skipped', '- [x] Code review: not run'])(
    'rejects an invalid code-review outcome: %s',
    (outcome) => {
      const tempDir = mkdtempSync(join(tmpdir(), 'pr-template-hook-'));
      const bodyPath = join(tempDir, 'body.md');
      const body = readFileSync(resolve(repoRoot, '.github/pull_request_template.md'), 'utf8')
        .replace('- [ ] docs', '- [x] docs')
        .replace('- [ ] Code review:', outcome);

      try {
        writeFileSync(bodyPath, body);
        const result = runHook(
          '.claude/hooks/enforce-pr-template.sh',
          copilotPayload(`gh pr create --base dev --title "docs: test" --body-file "${bodyPath}"`),
        );

        expect(result.status).toBe(2);
        expect(result.stderr).toMatch(/Code review|code-review/i);
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    },
  );

  it('fails closed when the Copilot Bash payload has no command', () => {
    const result = runHook('.claude/hooks/enforce-pr-template.sh', {
      toolCalls: [{ id: 'test-call', name: 'bash', args: { description: 'missing command' } }],
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('could not read the Bash command');
  });

  it('fails closed when the workspace is not the repository root', () => {
    const settingsPath = resolve(repoRoot, '.claude/settings.json');
    const settings: {
      hooks: {
        PreToolUse: Array<{ matcher: string; hooks: Array<{ command: string }> }>;
      };
    } = JSON.parse(readFileSync(settingsPath, 'utf8'));
    const bashHooks = settings.hooks.PreToolUse.find((hook) => hook.matcher === 'Bash');
    const command = bashHooks?.hooks.find((hook) => hook.command.includes('enforce-pr-template.sh'))?.command;
    const tempDir = mkdtempSync(join(tmpdir(), 'hook-workspace-'));

    try {
      expect(command).toBeDefined();
      const result = spawnSync('bash', ['-c', command ?? ''], {
        cwd: tempDir,
        encoding: 'utf8',
        input: JSON.stringify(copilotPayload('gh pr create --body-file -')),
      });

      expect(result.status).toBe(2);
      expect(result.stderr).toContain('open the repository root');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it.each(['.claude/hooks/enforce-git-workflow.sh', '.codex/hooks/enforce-git-workflow.sh'])(
    '%s blocks unsafe force pushes from a Copilot tool payload',
    (hookPath) => {
      const result = runHook(hookPath, copilotPayload('git push --force origin docs/test'));

      expect(result.status).toBe(2);
      expect(result.stderr).toContain('--force-with-lease');
    },
  );

  it('detects PR creation in the Copilot post-tool hook', () => {
    const result = runHook(
      '.claude/hooks/after-pr-create.sh',
      copilotPayload('cd be-demo && gh pr create --base dev --title "docs: test" --body-file /tmp/body.md'),
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('gh pr checks <PR number> --watch');
  });
});
