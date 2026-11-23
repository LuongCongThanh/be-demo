import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  checkCopilotHookSource,
  checkHookRegistrations,
  checkMirrors,
  checkSharedFlows,
  syncMirrors,
  watchMirrors,
} from './sync-agent-configs.mjs';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const fixtureGroups = [
  {
    name: 'fixture rules',
    source: '.agents/rules',
    roots: ['.agents/rules', '.codex/rules', '.github/rules'],
  },
];

async function createTestRoot(prefix) {
  return mkdtemp(join(tmpdir(), `agent-config-sync-${prefix}-`));
}

async function createFixture() {
  const root = await createTestRoot('mirror');
  const source = join(root, '.agents/rules/policy.md');
  await mkdir(join(root, '.agents/rules'), { recursive: true });
  await mkdir(join(root, '.codex/rules'), { recursive: true });
  await mkdir(join(root, '.github/rules'), { recursive: true });
  await writeFile(source, 'initial policy\n');
  await syncMirrors(root, { groups: fixtureGroups });
  return { root, source };
}

async function waitFor(predicate, timeoutMs = 3000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail('Timed out waiting for the watcher to synchronize the mirror.');
}

test('checked-in agent mirrors and native hook registrations are consistent', async () => {
  assert.deepEqual(await checkMirrors(repoRoot), []);
  assert.deepEqual(await checkHookRegistrations(repoRoot), []);
  assert.deepEqual(await checkCopilotHookSource(repoRoot), []);
  assert.deepEqual(await checkSharedFlows(repoRoot), []);
});

test('watch starts only when the checked-in native hook registrations match', async () => {
  const controller = new AbortController();
  let markStarted;
  const watcherStarted = new Promise((resolve) => {
    markStarted = resolve;
  });
  const watcher = watchMirrors(repoRoot, {
    intervalMs: 50,
    signal: controller.signal,
    log: markStarted,
  });

  await watcherStarted;
  controller.abort();
  await watcher;
});

test('check rejects a hook registration removed from one native config', async (context) => {
  const root = await createTestRoot('hooks');
  context.after(() => rm(root, { recursive: true, force: true }));

  const configurations = [
    { path: '.claude/settings.json', hooks: '.claude/hooks' },
    { path: '.codex/hooks.json', hooks: '.codex/hooks' },
  ];
  const hookNames = [
    'after-pr-create.sh',
    'check-swagger-completeness.sh',
    'enforce-git-workflow.sh',
    'enforce-pr-template.sh',
    'protect-files.sh',
  ];

  for (const configuration of configurations) {
    const configPath = join(root, configuration.path);
    await mkdir(dirname(configPath), { recursive: true });
    await copyFile(join(repoRoot, configuration.path), configPath);
    for (const hookName of hookNames) {
      const hookPath = join(root, configuration.hooks, hookName);
      await mkdir(dirname(hookPath), { recursive: true });
      await writeFile(hookPath, '');
    }
  }

  const codexConfigPath = join(root, '.codex/hooks.json');
  const codexConfig = JSON.parse(await readFile(codexConfigPath, 'utf8'));
  codexConfig.hooks.PreToolUse = codexConfig.hooks.PreToolUse.map((registration) => ({
    ...registration,
    hooks: registration.hooks.filter((hook) => !hook.command.includes('protect-files.sh')),
  })).filter((registration) => registration.hooks.length > 0);
  await writeFile(codexConfigPath, JSON.stringify(codexConfig));

  const errors = await checkHookRegistrations(root);
  assert.ok(errors.some((error) => error.includes('.codex/hooks.json hook registrations differ')));
});

test('sync imports changes from a selected native mirror', async (context) => {
  const { root, source } = await createFixture();
  context.after(() => rm(root, { recursive: true, force: true }));

  const selectedMirror = join(root, '.codex/rules/policy.md');
  await writeFile(selectedMirror, 'updated from Codex\n');
  await syncMirrors(root, { groups: fixtureGroups, fromPath: '.codex/rules' });

  assert.equal(await readFile(source, 'utf8'), 'updated from Codex\n');
  assert.equal(await readFile(join(root, '.github/rules/policy.md'), 'utf8'), 'updated from Codex\n');
});

test('sync reports divergent edits and stale target-only files without changing them', async (context) => {
  const { root, source } = await createFixture();
  context.after(() => rm(root, { recursive: true, force: true }));

  const target = join(root, '.codex/rules/policy.md');
  const stale = join(root, '.codex/rules/retired-policy.md');
  await writeFile(target, 'Codex-only edit\n');
  await writeFile(stale, 'target-only content\n');

  await assert.rejects(syncMirrors(root, { groups: fixtureGroups }), (error) => {
    assert.match(error.message, /Sync conflict; no files were changed/);
    assert.match(error.message, /\.codex\/rules\/policy\.md differs/);
    assert.match(error.message, /\.codex\/rules\/retired-policy\.md exists only/);
    assert.match(error.message, /--from <mirror-root>/);
    assert.match(error.message, /--force/);
    return true;
  });

  assert.equal(await readFile(source, 'utf8'), 'initial policy\n');
  assert.equal(await readFile(target, 'utf8'), 'Codex-only edit\n');
  assert.equal(await readFile(stale, 'utf8'), 'target-only content\n');
});

test('force sync uses canonical files and removes stale target-only files', async (context) => {
  const { root } = await createFixture();
  context.after(() => rm(root, { recursive: true, force: true }));

  const target = join(root, '.codex/rules/policy.md');
  const stale = join(root, '.codex/rules/retired-policy.md');
  await writeFile(target, 'Codex-only edit\n');
  await writeFile(stale, 'target-only content\n');

  await syncMirrors(root, { groups: fixtureGroups, force: true });

  assert.equal(await readFile(target, 'utf8'), 'initial policy\n');
  await assert.rejects(readFile(stale), { code: 'ENOENT' });
});

test('watch propagates a single edit to every mirror', async (context) => {
  const { root, source } = await createFixture();
  context.after(() => rm(root, { recursive: true, force: true }));

  const controller = new AbortController();
  let markStarted;
  const watcherStarted = new Promise((resolve) => {
    markStarted = resolve;
  });
  const watcher = watchMirrors(root, {
    groups: fixtureGroups,
    intervalMs: 50,
    signal: controller.signal,
    log: markStarted,
    checkHooks: false,
  });
  await watcherStarted;
  await writeFile(source, 'updated while watching\n');
  await waitFor(async () => {
    const codex = await readFile(join(root, '.codex/rules/policy.md'), 'utf8');
    const github = await readFile(join(root, '.github/rules/policy.md'), 'utf8');
    return codex === 'updated while watching\n' && github === codex;
  });
  controller.abort();
  await watcher;
});

test('watch refuses conflicting simultaneous edits without overwriting either', async (context) => {
  const { root, source } = await createFixture();
  context.after(() => rm(root, { recursive: true, force: true }));

  const codex = join(root, '.codex/rules/policy.md');
  const github = join(root, '.github/rules/policy.md');
  const controller = new AbortController();
  let markStarted;
  const watcherStarted = new Promise((resolve) => {
    markStarted = resolve;
  });
  const watcher = watchMirrors(root, {
    groups: fixtureGroups,
    intervalMs: 1000,
    signal: controller.signal,
    log: markStarted,
    checkHooks: false,
  });

  await watcherStarted;
  await writeFile(source, 'source edit\n');
  await writeFile(codex, 'different Codex edit\n');
  await assert.rejects(watcher, /Sync conflict/);
  assert.equal(await readFile(source, 'utf8'), 'source edit\n');
  assert.equal(await readFile(codex, 'utf8'), 'different Codex edit\n');
  assert.equal(await readFile(github, 'utf8'), 'initial policy\n');
});

async function createFlowFixture() {
  const root = await createTestRoot('flows');
  const write = async (path, content) => {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content);
  };
  for (const name of ['feature', 'ship']) {
    await write(
      `docs/agents/flows/${name}.md`,
      `---\nskills: [tdd]\n---\n\nFollow docs/agents/execution-workflow.md, then call \`tdd\`.\n`,
    );
    await write(`.agents/skills/${name}/SKILL.md`, `Follow docs/agents/flows/${name}.md.\n`);
  }
  await write('.agents/skills/tdd/SKILL.md', 'tdd\n');
  return { root, write };
}

test('shared flows pass when every entry skill points at its flow and named skills are vendored', async (context) => {
  const { root } = await createFlowFixture();
  context.after(() => rm(root, { recursive: true, force: true }));
  assert.deepEqual(await checkSharedFlows(root), []);
});

test('shared flows reject a flow that names a skill missing from .agents/skills', async (context) => {
  const { root, write } = await createFlowFixture();
  context.after(() => rm(root, { recursive: true, force: true }));
  await write(
    'docs/agents/flows/feature.md',
    '---\nskills: [tdd, grill-with-docs]\n---\n\ndocs/agents/execution-workflow.md\n',
  );
  const errors = await checkSharedFlows(root);
  assert.ok(errors.some((error) => error.includes('docs/agents/flows/feature.md names skill grill-with-docs')));
});

test('shared flows reject an entry skill that does not reference its flow', async (context) => {
  const { root, write } = await createFlowFixture();
  context.after(() => rm(root, { recursive: true, force: true }));
  await write('.agents/skills/ship/SKILL.md', 'Do the shipping steps here.\n');
  const errors = await checkSharedFlows(root);
  assert.ok(
    errors.some((error) => error.includes('.agents/skills/ship/SKILL.md must reference docs/agents/flows/ship.md')),
  );
});

test('shared flows reject a missing flow document', async (context) => {
  const { root } = await createFlowFixture();
  context.after(() => rm(root, { recursive: true, force: true }));
  await rm(join(root, 'docs/agents/flows/ship.md'));
  const errors = await checkSharedFlows(root);
  assert.ok(errors.some((error) => error.includes('Missing shared flow: docs/agents/flows/ship.md')));
});

test('shared flows reject a Claude-only command that would shadow the shared skill', async (context) => {
  const { root, write } = await createFlowFixture();
  context.after(() => rm(root, { recursive: true, force: true }));
  await write('.claude/commands/feature.md', 'Claude-only feature workflow\n');
  const errors = await checkSharedFlows(root);
  assert.ok(errors.some((error) => error.includes('.claude/commands/feature.md')));
});

test('shared flows reject a flow without a skills frontmatter list', async (context) => {
  const { root, write } = await createFlowFixture();
  context.after(() => rm(root, { recursive: true, force: true }));
  await write('docs/agents/flows/ship.md', '# Ship\n\ndocs/agents/execution-workflow.md\n');
  const errors = await checkSharedFlows(root);
  assert.ok(errors.some((error) => error.includes('docs/agents/flows/ship.md must declare its skills')));
});

test('check rejects repository hooks under .github/hooks because Copilot already runs .claude/settings.json', async (context) => {
  const root = await createTestRoot('copilot-hooks');
  context.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, '.github/hooks'), { recursive: true });
  await writeFile(join(root, '.github/hooks/hooks.json'), '{"version":1,"hooks":{}}');
  const errors = await checkCopilotHookSource(root);
  assert.ok(errors.some((error) => error.includes('.github/hooks/hooks.json')));
});

test('check accepts a repository without .github/hooks', async (context) => {
  const root = await createTestRoot('copilot-hooks-none');
  context.after(() => rm(root, { recursive: true, force: true }));
  assert.deepEqual(await checkCopilotHookSource(root), []);
});
