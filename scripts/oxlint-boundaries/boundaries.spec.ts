// Probes: each lint rule catches exactly one violation and lets the legal import through.
// Fixtures are written into a temp directory (not src/), linted with a config built by the real generator.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { buildOxlintConfig } from '../generate-oxlint-boundaries.js';

const OXLINT = join(dirname(fileURLToPath(import.meta.url)), '../../node_modules/.bin/oxlint');
const work = mkdtempSync(join(tmpdir(), 'oxlint-boundary-probe-'));
afterAll(() => rmSync(work, { recursive: true, force: true }));

const config = buildOxlintConfig({
  modules: ['alpha', 'beta', 'gamma', 'shop'],
  migratedModules: ['alpha', 'shop'],
  features: { shop: ['cat', 'prod'] },
  maxLinesExempt: ['src/modules/gamma/exempt-big.ts'],
});

let seq = 0;
/** Lints `files` (path -> content) and returns tags per file, e.g. ['L1', 'permissions']. */
function lint(files: Record<string, string>): Record<string, string[]> {
  const dir = join(work, String(seq++));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
  writeFileSync(join(dir, 'oxlint.json'), JSON.stringify(config));
  const run = spawnSync(OXLINT, ['-c', 'oxlint.json', '-f', 'json', 'src'], { cwd: dir, encoding: 'utf8' });
  const { diagnostics } = JSON.parse(run.stdout) as {
    diagnostics: { code: string; help?: string; filename: string }[];
  };
  const tags: Record<string, string[]> = Object.fromEntries(Object.keys(files).map((f) => [f, []]));
  for (const d of diagnostics) {
    const tag = /^Luật (\d)/.exec(d.help ?? '')?.[1];
    if (tag) tags[d.filename]?.push(`L${tag}`);
    else if (d.code === 'eslint(max-lines)') tags[d.filename]?.push('max-lines');
    else if (d.help?.startsWith('Dùng @Authorize')) tags[d.filename]?.push('permissions');
  }
  for (const [file, list] of Object.entries(tags)) tags[file] = [...new Set(list)].sort(); // oxlint prints each restricted import twice
  return tags;
}

const imp = (spec: string, names = 'x') =>
  `import { ${names} } from '${spec}';\nvoid ${names.split(',')[0]!.trim()};\n`;
const one = (path: string, content: string) => lint({ [path]: content })[path];

describe('rule 1: domain/ is pure', () => {
  it.each(['@nestjs/common', '#src/infrastructure/database/prisma.service.js', '#src/generated/prisma/client.js'])(
    'rejects %s',
    (spec) => expect(one('src/modules/alpha/domain/a.ts', imp(spec))).toContain('L1'),
  );
  it('allows a sibling domain import and node builtins', () => {
    expect(one('src/modules/alpha/domain/a.ts', imp('#src/modules/alpha/domain/b.js') + imp('node:fs'))).toEqual([]);
  });
});

describe('rule 2: application/ goes through ports', () => {
  it.each([
    '#src/generated/prisma/client.js',
    '#src/infrastructure/database/prisma.service.js',
    'nestjs-cls',
    '@nestjs-cls/transactional',
    '#src/infrastructure/mail/smtp-mail.adapter.js',
    '#src/modules/alpha/infrastructure/prisma-alpha.repository.js',
  ])('rejects %s', (spec) => expect(one('src/modules/alpha/application/s.ts', imp(spec))).toContain('L2'));
  it('allows shared *.port.js and its own ports', () => {
    const code =
      imp('#src/infrastructure/database/transaction-runner.port.js') + imp('#src/modules/alpha/application/ports/p.js');
    expect(one('src/modules/alpha/application/s.ts', code)).toEqual([]);
  });
});

describe('rule 3: no HTTP exceptions in domain/ and application/', () => {
  it.each(['domain', 'application'])('rejects NotFoundException in %s', (layer) => {
    const path = `src/modules/alpha/${layer}/a.ts`;
    expect(one(path, imp('@nestjs/common', 'NotFoundException'))).toContain('L3');
  });
  it('allows other @nestjs/common names in application/', () => {
    expect(one('src/modules/alpha/application/a.ts', imp('@nestjs/common', 'Injectable'))).toEqual([]);
  });
});

describe('rule 4: surfaces do not touch Prisma', () => {
  it.each(['admin', 'storefront', 'presentation'])('rejects PrismaService and generated in %s', (dir) => {
    const path = `src/modules/alpha/${dir}/c.ts`;
    const code = imp('#src/infrastructure/database/prisma.service.js') + imp('#src/generated/prisma/client.js', 'y');
    expect(one(path, code)).toEqual(['L4']);
  });
  it('allows application services', () => {
    expect(one('src/modules/alpha/admin/c.ts', imp('#src/modules/alpha/application/alpha.service.js'))).toEqual([]);
  });
});

describe('rule 5: modules only see each other through two files', () => {
  const from = 'src/modules/alpha/application/s.ts';
  it('allows beta.module.js and application/beta.service.js', () => {
    expect(
      one(from, imp('#src/modules/beta/beta.module.js') + imp('#src/modules/beta/application/beta.service.js', 'y')),
    ).toEqual([]);
  });
  it.each([
    '#src/modules/beta/domain/rules.js',
    '#src/modules/beta/application/other.js',
    '#src/modules/beta/application/ports/p.js',
    '#src/modules/gamma/gamma.service.js',
  ])('rejects %s', (spec) => expect(one(from, imp(spec))).toContain('L5'));
  it('applies to files at the module root too', () => {
    expect(one('src/modules/alpha/alpha.module.ts', imp('#src/modules/beta/domain/rules.js'))).toContain('L5');
  });
  it('does not apply to a module that is not migrated', () => {
    expect(one('src/modules/gamma/application/s.ts', imp('#src/modules/beta/domain/rules.js'))).toEqual([]);
  });
});

describe('rule 6: features see each other through three things', () => {
  const from = 'src/modules/shop/cat/application/c.service.ts';
  it('allows domain/, presentation/ and application/<y>.service.js', () => {
    const code =
      imp('#src/modules/shop/prod/domain/d.js') +
      imp('#src/modules/shop/prod/presentation/p.js', 'y') +
      imp('#src/modules/shop/prod/application/prod.service.js', 'z');
    expect(one(from, code)).toEqual([]);
  });
  it.each([
    '#src/modules/shop/prod/infrastructure/repo.js',
    '#src/modules/shop/prod/application/ports/p.js',
    '#src/modules/shop/prod/application/other.service.js',
    '#src/modules/shop/prod/admin/c.js',
  ])('rejects %s', (spec) => expect(one(from, imp(spec))).toContain('L6'));
  it('allows a feature to import itself', () => {
    expect(one(from, imp('#src/modules/shop/cat/domain/d.js'))).toEqual([]);
  });
});

describe('rule 7: size and relative imports', () => {
  const lines = (n: number, line: string) => Array.from({ length: n }, () => line).join('\n') + '\n';
  const code = (n: number) => lines(n, 'export const a = 1;').replace(/a = 1/g, () => `a${n++} = 1`);
  it('rejects 201 code lines, ignores blank and comment lines', () => {
    const files = {
      'src/modules/gamma/big.ts': code(201),
      'src/modules/gamma/padded.ts': code(200) + lines(50, '') + lines(50, '// note'),
    };
    const tags = lint(files);
    expect(tags['src/modules/gamma/big.ts']).toEqual(['max-lines']);
    expect(tags['src/modules/gamma/padded.ts']).toEqual([]);
  });
  it('exempts specs, generated code and the temporary list', () => {
    const tags = lint({
      'src/modules/gamma/big.spec.ts': code(201),
      'src/generated/g.ts': code(201),
      'src/modules/gamma/exempt-big.ts': code(201),
    });
    expect(Object.values(tags).flat()).toEqual([]);
  });
  it.each(['./sibling.js', '../up.js'])('rejects relative import %s everywhere in src', (spec) => {
    expect(one('src/modules/gamma/s.ts', imp(spec))).toEqual(['L7']);
    expect(one('src/security/authorization/a.ts', imp(spec))).toEqual(['L7']);
  });
  it('leaves relative imports in generated code alone', () => {
    expect(one('src/generated/g.ts', imp('./sibling.js'))).toEqual([]);
  });
});

describe('overlapping groups keep every rule', () => {
  const guard = '#src/security/authorization/permissions/permissions.guard.js';
  it('a domain file in a migrated module gets rules 1, 3, 5, 7 and permissions at once', () => {
    const code =
      imp('@nestjs/common', 'BadRequestException') +
      imp('#src/modules/beta/domain/rules.js', 'y') +
      imp(guard, 'z') +
      imp('./sibling.js', 'w');
    expect(one('src/modules/alpha/domain/a.ts', code)).toEqual(['L1', 'L3', 'L5', 'L7', 'permissions']);
  });
  it('a feature application file gets rules 2, 5, 6 and permissions at once', () => {
    const code =
      imp('nestjs-cls') +
      imp('#src/modules/beta/domain/rules.js', 'y') +
      imp('#src/modules/shop/prod/infrastructure/repo.js', 'z') +
      imp(guard, 'w');
    expect(one('src/modules/shop/cat/application/c.service.ts', code)).toEqual(['L2', 'L5', 'L6', 'permissions']);
  });
  it('permissions stay enforced in unmigrated modules and only src/security/authorization may import the guard', () => {
    expect(one('src/modules/gamma/s.ts', imp(guard))).toEqual(['permissions']);
    expect(one('src/security/authorization/a.ts', imp(guard))).toEqual([]);
  });
});
