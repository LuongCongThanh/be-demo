import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  checkHookRegistrations,
  checkMirrors,
  checkSharedWorkflowEntrypoints,
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
  assert.deepEqual(await checkSharedWorkflowEntrypoints(repoRoot), []);
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
    { path: '.github/hooks/hooks.json', hooks: '.github/hooks/scripts' },
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
