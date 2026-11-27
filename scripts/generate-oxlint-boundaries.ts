// Generates oxlint.json: the permissions rule, the max-lines rule, the relative-import ban and the
// per-module layer/boundary rules from docs/convention/module-architecture-conventions.md §9.
//
// oxlint overrides REPLACE (never merge) `no-restricted-imports`, and for a file matched by several
// overrides only the last one counts. So every override below carries the complete rule set for its
// file group, and more specific groups come later. Do not edit the generated part of oxlint.json by hand.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';

// ---- Inputs (edit these) ----------------------------------------------------------------------

/** Modules whose layer and boundary rules (1-6) are enforced. Each module-refactor PR adds its module. */
export const MIGRATED_MODULES: string[] = ['inventory', 'voucher'];

/** Features of the multi-feature modules (each repeats the layout inside `src/modules/<module>/<feature>/`). */
export const MODULE_FEATURES: Record<string, string[]> = {
  catalog: ['category', 'product', 'product-option', 'pricing'],
  identity: ['auth', 'access', 'internal-account'],
};

/**
 * Temporary exemption from max-lines. Each split PR removes its file; remove this list when empty.
 * Ticket 09 listed 13 files by raw line count; only these 7 exceed 200 lines once blank lines and comments are skipped.
 */
export const MAX_LINES_TEMPORARY_EXEMPT: string[] = [
  'src/modules/checkout/services/storefront/checkout.service.ts',
  'src/modules/identity/access.service.ts',
  'src/modules/identity/auth/services/storefront/session.service.ts',
  'src/modules/catalog/category/infrastructure/persistence/relational/adapters/prisma-category.repository.ts',
  'src/modules/catalog/category/infrastructure/persistence/relational/adapters/prisma-category-translation.persistence.ts',
  'src/modules/catalog/product/services/admin/admin-product.service.ts',
  'src/modules/cart/cart.service.ts',
];

// ---- Generator --------------------------------------------------------------------------------

const MAX_LINES = { max: 200, skipBlankLines: true, skipComments: true };

const PRISMA_SERVICE = '#src/infrastructure/database/prisma.service.js';
// Every HttpException subclass exported by @nestjs/common/exceptions (IntrinsicException is not one), plus the base class.
const HTTP_EXCEPTIONS = [
  'HttpException',
  'BadGatewayException',
  'BadRequestException',
  'ConflictException',
  'ForbiddenException',
  'GatewayTimeoutException',
  'GoneException',
  'HttpVersionNotSupportedException',
  'ImATeapotException',
  'InternalServerErrorException',
  'MethodNotAllowedException',
  'MisdirectedException',
  'NotAcceptableException',
  'NotFoundException',
  'NotImplementedException',
  'PayloadTooLargeException',
  'PreconditionFailedException',
  'RequestTimeoutException',
  'ServiceUnavailableException',
  'UnauthorizedException',
  'UnprocessableEntityException',
  'UnsupportedMediaTypeException',
];

type PathRestriction = { name: string; message: string; importNames?: string[] };
type PatternRestriction = { group?: string[]; regex?: string; message: string };
type Restrictions = { paths: PathRestriction[]; patterns: PatternRestriction[] };

const PERMISSIONS_PATHS: PathRestriction[] = [
  {
    name: '#src/security/authorization/permissions/permissions.guard.js',
    message:
      'Dùng @Authorize(...) từ #src/security/authorization/permissions/authorize.decorator.js thay vì RequirePermissions/PermissionsGuard trực tiếp.',
  },
  {
    name: '#src/security/authorization/permissions/permissions.decorator.js',
    message:
      'Dùng @Authorize(...) từ #src/security/authorization/permissions/authorize.decorator.js thay vì RequirePermissions/PermissionsGuard trực tiếp.',
  },
];

const RELATIVE_IMPORT: PatternRestriction = {
  regex: '^\\.{1,2}(/|$)',
  message: 'Luật 7: không import tương đối; dùng alias #src/... (nếu không luật 5 và 6 bị lách).',
};

const noRestrictedImports = ({ paths, patterns }: Restrictions) => [
  'error',
  {
    ...(paths.length > 0 ? { paths } : {}),
    ...(patterns.length > 0 ? { patterns } : {}),
  },
];

const merge = (...parts: Partial<Restrictions>[]): Restrictions => ({
  paths: parts.flatMap((p) => p.paths ?? []),
  patterns: parts.flatMap((p) => p.patterns ?? []),
});

const BASE: Restrictions = { paths: PERMISSIONS_PATHS, patterns: [RELATIVE_IMPORT] };

const DOMAIN_RULES: Restrictions = merge({
  patterns: [
    {
      group: ['@nestjs/**', '#src/infrastructure/**', '#src/generated/**'],
      message: 'Luật 1: domain/ thuần, không import @nestjs, infrastructure hay generated.',
    },
  ],
});

// Rule 2 names only the shared infrastructure and the scope's OWN infrastructure folder. Its `!*.port.js`
// negations share one gitignore matcher with the patterns of rules 5 and 6, so a broad
// `#src/modules/**/infrastructure/**` negation would re-include another module's or feature's port and hide it
// from those rules. Other modules/features are rules 5/6's job.
const applicationRules = (dir: string): Restrictions => {
  const own = `#${dir}/infrastructure`;
  return merge({
    paths: [{ name: PRISMA_SERVICE, message: 'Luật 2: application/ không import PrismaService; đi qua Port.' }],
    patterns: [
      {
        group: ['#src/generated/**', 'nestjs-cls', '@nestjs-cls/**'],
        message: 'Luật 2: application/ không import Prisma generated hay nestjs-cls; đi qua Port.',
      },
      {
        group: ['#src/infrastructure/**', '!#src/infrastructure/**/*.port.js', `${own}/**`, `!${own}/**/*.port.js`],
        message:
          'Luật 2: application/ chỉ import port dùng chung (*.port.js) từ infrastructure/, không import adapter.',
      },
    ],
  });
};

const HTTP_EXCEPTION_RULES: Restrictions = merge({
  paths: [
    {
      name: '@nestjs/common',
      importNames: HTTP_EXCEPTIONS,
      message: 'Luật 3: domain/ và application/ ném lỗi nghiệp vụ từ #src/common/errors, không ném HTTP exception.',
    },
  ],
});

const SURFACE_RULES: Restrictions = merge({
  paths: [{ name: PRISMA_SERVICE, message: 'Luật 4: admin/, storefront/, presentation/ không import PrismaService.' }],
  patterns: [
    {
      group: ['#src/generated/**'],
      message: 'Luật 4: admin/, storefront/, presentation/ không import Prisma generated.',
    },
  ],
});

// One pattern per other module, with no self-negation: oxlint compiles every pattern of a rule into ONE
// gitignore matcher, so a `!` in one pattern re-includes matches of the others (probe: a `!#src/modules/<self>/**`
// silently disabled rules 2 and 6). Each negation below only names that module's two public files.
const crossModuleRules = (self: string, all: string[]): Restrictions =>
  merge({
    patterns: all
      .filter((other) => other !== self)
      .map((other) => ({
        group: [
          `#src/modules/${other}/**`,
          `!#src/modules/${other}/${other}.module.js`,
          `!#src/modules/${other}/application/${other}.service.js`,
        ],
        message: `Luật 5: ${self} chỉ import ${other}.module.js và application/${other}.service.js của module ${other}.`,
      })),
  });

const crossFeatureRules = (module: string, self: string, features: string[]): Restrictions =>
  merge({
    patterns: features
      .filter((other) => other !== self)
      .map((other) => ({
        group: [
          `#src/modules/${module}/${other}/**`,
          `!#src/modules/${module}/${other}/domain/**`,
          `!#src/modules/${module}/${other}/presentation/**`,
          `!#src/modules/${module}/${other}/application/${other}.service.js`,
        ],
        message: `Luật 6: feature ${self} chỉ import domain/, presentation/ và application/${other}.service.js của feature ${other}.`,
      })),
  });

type Override = { files: string[]; excludeFiles?: string[]; rules: Record<string, unknown> };

const importOverride = (files: string[], restrictions: Restrictions): Override => ({
  files,
  rules: { 'no-restricted-imports': noRestrictedImports(restrictions) },
});

export type GeneratorInput = {
  /** Directory names under src/modules. */
  modules: string[];
  migratedModules: string[];
  features: Record<string, string[]>;
  maxLinesExempt: string[];
};

export function buildOxlintConfig(input: GeneratorInput) {
  const { modules, migratedModules, features, maxLinesExempt } = input;
  const overrides: Override[] = [];

  // Every src file: permissions + relative-import ban + max-lines (generated code is exempt).
  overrides.push({
    files: ['src/**'],
    excludeFiles: ['src/generated/**'],
    rules: {
      'no-restricted-imports': noRestrictedImports(BASE),
      'max-lines': ['error', MAX_LINES],
    },
  });
  // The authorization module defines the guard, so it may import it; the relative-import ban still applies.
  overrides.push(importOverride(['src/security/authorization/**'], { paths: [], patterns: [RELATIVE_IMPORT] }));

  for (const module of migratedModules) {
    const root = `src/modules/${module}`;
    const moduleFeatures = features[module] ?? [];
    const cross = crossModuleRules(module, modules);
    // Least specific first: the whole module, then each feature, then each layer folder.
    overrides.push(importOverride([`${root}/**`], merge(BASE, cross)));
    const scopes =
      moduleFeatures.length > 0
        ? moduleFeatures.map((f) => ({ dir: `${root}/${f}`, feature: f }))
        : [{ dir: root, feature: undefined }];
    for (const { dir, feature } of scopes) {
      const crossFeature = feature ? crossFeatureRules(module, feature, moduleFeatures) : merge();
      const scoped = merge(BASE, cross, crossFeature);
      if (feature) overrides.push(importOverride([`${dir}/**`], scoped));
      overrides.push(importOverride([`${dir}/domain/**`], merge(scoped, DOMAIN_RULES, HTTP_EXCEPTION_RULES)));
      overrides.push(
        importOverride([`${dir}/application/**`], merge(scoped, applicationRules(dir), HTTP_EXCEPTION_RULES)),
      );
      overrides.push(
        importOverride(
          [`${dir}/admin/**`, `${dir}/storefront/**`, `${dir}/presentation/**`],
          merge(scoped, SURFACE_RULES),
        ),
      );
    }
  }

  // Exemptions last (max-lines is a different rule, so these do not touch the import rules above).
  overrides.push({
    files: ['src/generated/**', '**/*.spec.ts', '**/*.e2e-spec.ts', ...maxLinesExempt],
    rules: { 'max-lines': 'off' },
  });

  return {
    $schema: 'https://raw.githubusercontent.com/oxc-project/oxc/main/crates/oxc_linter/src/rules.rs',
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-floating-promises': 'warn',
      'no-restricted-imports': noRestrictedImports({ paths: PERMISSIONS_PATHS, patterns: [] }),
    },
    env: { node: true },
    overrides,
  };
}

/** Counts lines the max-lines rule counts: skips blank lines and `//` / block comment lines. */
function countCodeLines(text: string): number {
  let inBlock = false;
  let count = 0;
  for (const raw of text.split('\n')) {
    let line = raw.trim();
    if (inBlock) {
      const end = line.indexOf('*/');
      if (end === -1) continue;
      inBlock = false;
      line = line.slice(end + 2).trim();
    }
    while (line.startsWith('/*')) {
      const end = line.indexOf('*/', 2);
      if (end === -1) {
        inBlock = true;
        line = '';
        break;
      }
      line = line.slice(end + 2).trim();
    }
    if (line === '' || line.startsWith('//')) continue;
    count++;
  }
  return count;
}

/** Problems with the temporary exemption list: files that are gone or no longer exceed the limit. */
export function checkMaxLinesExemptions(exempt: string[], root: string): string[] {
  const problems: string[] = [];
  for (const file of exempt) {
    const path = join(root, file);
    if (!existsSync(path)) {
      problems.push(`max-lines exemption points to a missing file: ${file}`);
      continue;
    }
    const lines = countCodeLines(readFileSync(path, 'utf8'));
    if (lines <= MAX_LINES.max) {
      problems.push(
        `${file} has ${lines} counted lines (limit ${MAX_LINES.max}): drop it from MAX_LINES_TEMPORARY_EXEMPT.`,
      );
    }
  }
  return problems;
}

// ---- CLI --------------------------------------------------------------------------------------

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function listModules(): string[] {
  const dir = join(ROOT, 'src/modules');
  return readdirSync(dir)
    .filter((name) => statSync(join(dir, name)).isDirectory())
    .sort();
}

export async function render(input: GeneratorInput): Promise<string> {
  const text = JSON.stringify(buildOxlintConfig(input), null, 2);
  const options = (await resolveConfig(join(ROOT, 'oxlint.json'))) ?? {};
  return format(text, { ...options, parser: 'json' });
}

async function main(): Promise<void> {
  const mode = process.argv[2];
  const input: GeneratorInput = {
    modules: listModules(),
    migratedModules: MIGRATED_MODULES,
    features: MODULE_FEATURES,
    maxLinesExempt: MAX_LINES_TEMPORARY_EXEMPT,
  };
  const problems = checkMaxLinesExemptions(MAX_LINES_TEMPORARY_EXEMPT, ROOT);
  if (problems.length > 0) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  const target = join(ROOT, 'oxlint.json');
  const expected = await render(input);
  if (mode === '--check') {
    if (readFileSync(target, 'utf8') !== expected) {
      console.error(
        'oxlint.json is out of date with scripts/generate-oxlint-boundaries.ts. Run: npm run lint:boundaries',
      );
      process.exit(1);
    }
    console.log('oxlint.json matches the generator.');
    return;
  }
  writeFileSync(target, expected);
  console.log('Wrote oxlint.json.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
