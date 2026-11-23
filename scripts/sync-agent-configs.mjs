import { createHash } from 'node:crypto';
import { chmod, lstat, mkdir, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));

export const MIRROR_GROUPS = [
  {
    name: 'Claude/Codex hook scripts',
    source: '.claude/hooks',
    roots: ['.claude/hooks', '.codex/hooks'],
  },
  {
    name: 'Project skills',
    source: '.agents/skills',
    roots: ['.agents/skills', '.github/skills', '.claude/skills'],
  },
];

const REQUIRED_HOOKS = {
  preToolUse: ['enforce-git-workflow.sh', 'enforce-pr-template.sh', 'protect-files.sh'],
  postToolUse: ['after-pr-create.sh', 'check-swagger-completeness.sh'],
};

const SHARED_FLOWS = ['feature', 'ship'];

const HOOK_CONFIGS = [
  {
    path: '.claude/settings.json',
    scriptRoot: '.claude/hooks',
    events: { PreToolUse: 'preToolUse', PostToolUse: 'postToolUse' },
    getScript: (hook) => hook.command,
  },
  {
    path: '.codex/hooks.json',
    scriptRoot: '.codex/hooks',
    events: { PreToolUse: 'preToolUse', PostToolUse: 'postToolUse' },
    getScript: (hook) => hook.command,
  },
  {
    path: '.github/hooks/hooks.json',
    scriptRoot: '.github/hooks/scripts',
    events: { preToolUse: 'preToolUse', postToolUse: 'postToolUse' },
    getScript: (hook) => hook.bash,
  },
];

function isIncluded(group, path) {
  return !group.include || group.include(path);
}

async function assertDirectory(path) {
  let details;
  try {
    details = await lstat(path);
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error(`Required mirror directory is missing: ${path}`);
    throw error;
  }
  if (!details.isDirectory()) throw new Error(`Expected a mirror directory: ${path}`);
}

async function listFiles(directory, aliasDirectory = directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }

  const files = [];
  for (const entry of entries) {
    const absolutePath = join(directory, entry.name);
    const aliasedPath = join(aliasDirectory, entry.name);
    if (entry.isSymbolicLink()) {
      const resolvedPath = await realpath(absolutePath);
      const details = await lstat(resolvedPath);
      if (details.isDirectory()) {
        files.push(...(await listFiles(resolvedPath, aliasedPath)));
        continue;
      }
      if (details.isFile()) {
        files.push(aliasedPath);
        continue;
      }
      throw new Error(`Unsupported symbolic link target: ${absolutePath}`);
    }
    if (entry.isDirectory()) {
      files.push(...(await listFiles(absolutePath, aliasedPath)));
    } else if (entry.isFile()) {
      files.push(aliasedPath);
    }
  }
  return files.sort();
}

export async function discoverMirrorEntries(root, groups = MIRROR_GROUPS) {
  const entries = [];
  for (const group of groups) {
    const relativeNames = new Set();
    for (const mirrorRoot of group.roots) {
      const absoluteRoot = resolve(root, mirrorRoot);
      await assertDirectory(absoluteRoot);
      for (const file of await listFiles(absoluteRoot)) {
        const relativePath = relative(absoluteRoot, file).split(sep).join('/');
        if (!isIncluded(group, relativePath)) continue;
        relativeNames.add(relativePath);
      }
    }

    for (const relativePath of relativeNames) {
      entries.push({
        id: `${group.name}:${relativePath}`,
        group,
        relativePath,
        paths: group.roots.map((mirrorRoot) => resolve(root, mirrorRoot, relativePath)),
      });
    }
  }
  return entries;
}

export async function fileState(path) {
  try {
    const details = await lstat(path);
    if (!details.isFile()) throw new Error(`Expected a regular file: ${path}`);
    const content = await readFile(path);
    return {
      hash: createHash('sha256').update(content).digest('hex'),
      mode: details.mode & 0o777,
    };
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function equalStates(left, right) {
  return left === null || right === null ? left === right : left.hash === right.hash && left.mode === right.mode;
}

export async function checkMirrors(root = REPO_ROOT, groups = MIRROR_GROUPS) {
  const errors = [];
  for (const entry of await discoverMirrorEntries(root, groups)) {
    const states = await Promise.all(entry.paths.map(fileState));
    if (!states.every((state) => equalStates(state, states[0]))) {
      const missing = entry.paths.filter((path, index) => states[index] === null);
      const details = missing.length
        ? `missing from ${missing.map((path) => relative(root, path)).join(', ')}`
        : 'content or file mode differs';
      errors.push(`${entry.group.name}/${entry.relativePath}: ${details}`);
    }
  }
  return errors;
}

async function writeAtomic(sourcePath, targetPath) {
  const content = await readFile(sourcePath);
  const sourceDetails = await lstat(sourcePath);
  await mkdir(dirname(targetPath), { recursive: true });
  const temporaryPath = `${targetPath}.sync-${process.pid}-${Date.now()}`;
  try {
    await writeFile(temporaryPath, content, { mode: sourceDetails.mode & 0o777 });
    await chmod(temporaryPath, sourceDetails.mode & 0o777);
    await rename(temporaryPath, targetPath);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

function resolveSelectedSource(root, group, fromPath) {
  if (!fromPath) return resolve(root, group.source);
  const selected = resolve(root, fromPath);
  const matched = group.roots.find((mirrorRoot) => resolve(root, mirrorRoot) === selected);
  return matched ? selected : null;
}

export async function syncMirrors(root = REPO_ROOT, { groups = MIRROR_GROUPS, fromPath, force = false } = {}) {
  const copied = [];
  const conflicts = [];
  const operations = [];
  const targetRootsToCreate = new Set();
  for (const group of groups) {
    const sourceRoot = resolveSelectedSource(root, group, fromPath);
    if (!sourceRoot) continue;
    await assertDirectory(sourceRoot);

    const sourceFiles = new Map();
    for (const file of await listFiles(sourceRoot)) {
      const relativePath = relative(sourceRoot, file).split(sep).join('/');
      if (isIncluded(group, relativePath)) sourceFiles.set(relativePath, file);
    }

    for (const mirrorRoot of group.roots) {
      const targetRoot = resolve(root, mirrorRoot);
      if (targetRoot === sourceRoot) continue;
      targetRootsToCreate.add(targetRoot);

      const targetFiles = await listFiles(targetRoot);
      const targetByRelativeName = new Map(
        targetFiles
          .map((file) => [relative(targetRoot, file).split(sep).join('/'), file])
          .filter(([path]) => isIncluded(group, path)),
      );

      for (const [relativePath, sourcePath] of sourceFiles) {
        const targetPath = resolve(targetRoot, relativePath);
        const sourceState = await fileState(sourcePath);
        const targetState = await fileState(targetPath);
        if (!equalStates(sourceState, targetState)) {
          if (targetState && !fromPath && !force) {
            conflicts.push(`${relative(root, targetPath)} differs from ${relative(root, sourcePath)}`);
          } else {
            operations.push({ type: 'write', sourcePath, targetPath });
          }
        }
        targetByRelativeName.delete(relativePath);
      }

      for (const stalePath of targetByRelativeName.values()) {
        if (!fromPath && !force) {
          conflicts.push(`${relative(root, stalePath)} exists only in the target mirror`);
        } else {
          operations.push({ type: 'remove', targetPath: stalePath });
        }
      }
    }
  }

  if (conflicts.length) {
    throw new Error(
      `Sync conflict; no files were changed:\n${conflicts.join('\n')}\nResolve the files manually, or rerun with --from <mirror-root> to choose a source mirror, or --force to use the canonical source and overwrite/remove target files.`,
    );
  }

  for (const targetRoot of targetRootsToCreate) {
    await mkdir(targetRoot, { recursive: true });
  }

  for (const operation of operations) {
    if (operation.type === 'write') {
      await writeAtomic(operation.sourcePath, operation.targetPath);
      copied.push(relative(root, operation.targetPath));
    } else {
      await rm(operation.targetPath);
      copied.push(`${relative(root, operation.targetPath)} (removed)`);
    }
  }

  const errors = await checkMirrors(root, groups);
  if (errors.length) throw new Error(`Sync did not converge:\n${errors.join('\n')}`);
  return copied;
}

export async function propagateDetectedChange(root, entry, previousStates) {
  const currentStates = new Map();
  for (const path of entry.paths) currentStates.set(path, await fileState(path));

  const changedPaths = entry.paths.filter(
    (path) => !equalStates(currentStates.get(path), previousStates.get(path) ?? null),
  );
  if (!changedPaths.length) return false;

  const changedStates = changedPaths.map((path) => currentStates.get(path));
  if (!changedStates.every((state) => equalStates(state, changedStates[0]))) {
    throw new Error(
      `Sync conflict in ${entry.group.name}/${entry.relativePath}; changed copies: ${changedPaths
        .map((path) => relative(root, path))
        .join(', ')}. Resolve the file, then run agents:sync --from <mirror-root>.`,
    );
  }

  const chosenPath = changedPaths[0];
  const chosenState = currentStates.get(chosenPath);
  for (const targetPath of entry.paths) {
    if (targetPath === chosenPath) continue;
    if (chosenState === null) {
      await rm(targetPath, { force: true });
    } else {
      await writeAtomic(chosenPath, targetPath);
    }
  }
  return true;
}

async function snapshotEntries(root, groups) {
  const entries = await discoverMirrorEntries(root, groups);
  const snapshots = new Map();
  for (const entry of entries) {
    snapshots.set(entry.id, new Map(await Promise.all(entry.paths.map(async (path) => [path, await fileState(path)]))));
  }
  return { entries, snapshots };
}

function delay(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

export async function watchMirrors(
  root = REPO_ROOT,
  { groups = MIRROR_GROUPS, intervalMs = 500, signal, log = console.log, checkHooks = true } = {},
) {
  const initialDrift = await checkMirrors(root, groups);
  if (initialDrift.length) {
    throw new Error(`Cannot start watcher while mirrors differ:\n${initialDrift.join('\n')}\nRun agents:sync first.`);
  }
  if (checkHooks) {
    const hookDrift = await checkHookRegistrations(root);
    if (hookDrift.length) {
      throw new Error(`Cannot start watcher while native hook registrations differ:\n${hookDrift.join('\n')}`);
    }
  }

  let { snapshots } = await snapshotEntries(root, groups);
  log(`Watching ${groups.length} agent configuration mirror groups (${intervalMs} ms polling).`);

  while (!signal?.aborted) {
    await delay(intervalMs);
    if (signal?.aborted) break;

    const current = await snapshotEntries(root, groups);
    for (const entry of current.entries) {
      const previousStates = snapshots.get(entry.id) ?? new Map(entry.paths.map((path) => [path, null]));
      if (await propagateDetectedChange(root, entry, previousStates)) {
        log(`Synchronized ${entry.group.name}/${entry.relativePath}.`);
      }
    }
    if (checkHooks) {
      const hookDrift = await checkHookRegistrations(root);
      if (hookDrift.length) {
        throw new Error(`Native hook registrations differ:\n${hookDrift.join('\n')}`);
      }
    }
    ({ snapshots } = await snapshotEntries(root, groups));
  }
}

function registeredHooks(config, specification) {
  const registered = { preToolUse: [], postToolUse: [] };
  for (const [event, normalizedEvent] of Object.entries(specification.events)) {
    for (const registration of config.hooks?.[event] ?? []) {
      for (const hook of registration.hooks ?? [registration]) {
        const command = specification.getScript(hook);
        const script = command?.match(/([A-Za-z0-9._-]+\.sh)(?:["'\s]|$)/)?.[1];
        if (script) registered[normalizedEvent].push(script);
      }
    }
  }
  for (const scripts of Object.values(registered)) scripts.sort();
  return registered;
}

export async function checkHookRegistrations(root = REPO_ROOT) {
  const registrations = [];
  const errors = [];
  for (const specification of HOOK_CONFIGS) {
    const configPath = resolve(root, specification.path);
    let config;
    try {
      config = JSON.parse(await readFile(configPath, 'utf8'));
    } catch (error) {
      throw new Error(`Unable to read ${specification.path}: ${error.message}`, { cause: error });
    }

    const hooks = registeredHooks(config, specification);
    for (const scripts of Object.values(hooks)) {
      for (const script of scripts) {
        const scriptPath = resolve(root, specification.scriptRoot, script);
        if (!(await fileState(scriptPath))) {
          errors.push(`${specification.path} registers missing hook ${relative(root, scriptPath)}`);
        }
      }
    }
    registrations.push({ path: specification.path, hooks });
  }

  const expected = JSON.stringify(registrations[0].hooks);
  if (expected !== JSON.stringify(REQUIRED_HOOKS)) {
    errors.push(`${registrations[0].path} is missing or has unexpected hook registrations`);
  }
  for (const registration of registrations.slice(1)) {
    if (JSON.stringify(registration.hooks) !== expected) {
      errors.push(`${registration.path} hook registrations differ from ${registrations[0].path}`);
    }
  }
  return errors;
}

async function readOptional(path) {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function flowSkills(content) {
  const frontmatter = content.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
  const list = frontmatter.match(/^skills:\s*\[([^\]]*)\]/m)?.[1] ?? '';
  return list
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
}

export async function checkSharedFlows(root = REPO_ROOT) {
  const errors = [];
  for (const name of SHARED_FLOWS) {
    const flowPath = `docs/agents/flows/${name}.md`;
    const flow = await readOptional(resolve(root, flowPath));
    if (flow === null) {
      errors.push(`Missing shared flow: ${flowPath}`);
    } else {
      if (!flow.includes('docs/agents/execution-workflow.md')) {
        errors.push(`${flowPath} must reference docs/agents/execution-workflow.md`);
      }
      const skills = flowSkills(flow);
      if (skills.length === 0) {
        errors.push(`${flowPath} must declare its skills in a \`skills: [...]\` frontmatter list`);
      }
      for (const skill of skills) {
        if (!(await fileState(resolve(root, '.agents/skills', skill, 'SKILL.md')))) {
          errors.push(`${flowPath} names skill ${skill}, which is not vendored in .agents/skills/`);
        }
      }
    }

    const entryPath = `.agents/skills/${name}/SKILL.md`;
    const entry = await readOptional(resolve(root, entryPath));
    if (entry === null) {
      errors.push(`Missing flow entry skill: ${entryPath}`);
    } else if (!entry.includes(flowPath)) {
      errors.push(`${entryPath} must reference ${flowPath}`);
    }

    const commandPath = `.claude/commands/${name}.md`;
    if (await fileState(resolve(root, commandPath))) {
      errors.push(`${commandPath} shadows the shared ${name} skill; remove the Claude-only command`);
    }
  }
  return errors;
}

async function runCheck(root) {
  const errors = [
    ...(await checkMirrors(root)),
    ...(await checkHookRegistrations(root)),
    ...(await checkSharedFlows(root)),
  ];
  if (errors.length) {
    console.error(`Agent configuration drift detected:\n- ${errors.join('\n- ')}`);
    process.exitCode = 1;
    return;
  }
  console.log('Agent configuration mirrors, hook registrations, and shared flows are consistent.');
}

function usage() {
  console.log(`Usage: node scripts/sync-agent-configs.mjs <sync|check|watch|test> [options]

  sync [--from <mirror-root>] [--force]
                               Copy canonical files; --from selects a mirror as the source.
                               Conflicts are preserved unless an explicit source or --force is used.
  check                         Fail when mirrored files or hook registrations drift.
  watch [--interval-ms <n>]     Propagate a single-file edit while this process runs.
  test                          Run the sync behavior tests.
`);
}

async function main(args) {
  const [command, ...options] = args;
  const fromIndex = options.indexOf('--from');
  const fromPath = fromIndex >= 0 ? options[fromIndex + 1] : undefined;
  const force = options.includes('--force');
  if (fromIndex >= 0 && !fromPath) throw new Error('--from requires a mirror root path.');
  if (fromIndex >= 0 && force) throw new Error('--from and --force cannot be combined.');

  if (command === 'sync') {
    const copied = await syncMirrors(REPO_ROOT, { fromPath, force });
    console.log(
      copied.length ? `Synchronized ${copied.length} file(s).` : 'All mirrored files were already synchronized.',
    );
    await runCheck(REPO_ROOT);
    return;
  }

  if (command === 'check') {
    await runCheck(REPO_ROOT);
    return;
  }

  if (command === 'watch') {
    const intervalIndex = options.indexOf('--interval-ms');
    const intervalMs = intervalIndex >= 0 ? Number(options[intervalIndex + 1]) : 500;
    if (!Number.isInteger(intervalMs) || intervalMs < 50) {
      throw new Error('--interval-ms must be an integer of at least 50.');
    }
    const controller = new AbortController();
    process.once('SIGINT', () => controller.abort());
    await watchMirrors(REPO_ROOT, { intervalMs, signal: controller.signal });
    return;
  }

  if (command === 'test') {
    const { spawnSync } = await import('node:child_process');
    const result = spawnSync(process.execPath, ['--test', 'scripts/sync-agent-configs.test.mjs'], {
      cwd: REPO_ROOT,
      stdio: 'inherit',
    });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exitCode = result.status ?? 1;
    return;
  }

  usage();
  if (command) process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
