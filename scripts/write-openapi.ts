import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Ghi hợp đồng OpenAPI ra `docs/openapi/openapi.json` (JSON ổn định, key sắp
 * xếp). File này là nguồn để phát hành theo tag `openapi-v*` (xem
 * .github/workflows/openapi-release.yml) và CI kiểm nó khớp với code.
 *
 * Chạy trên bản build (`dist/`, qua `npm run openapi:write` = build + `node` chạy thẳng file .ts):
 * Nest DI cần `emitDecoratorMetadata` mà tsx/esbuild không phát ra (và tsx nạp trùng bản @nestjs/core).
 *
 * Không cần database thật: app chỉ được tạo (không `init()`/`listen()`), nên
 * `PrismaService.onModuleInit` không chạy và không mở kết nối nào. Các biến
 * môi trường bắt buộc được điền giá trị giả nếu thiếu để qua bước validate.
 */

const placeholders: Record<string, string> = {
  DATABASE_URL: 'postgresql://openapi:openapi@localhost:5432/openapi',
  JWT_ACCESS_SECRET: 'openapi-contract-placeholder-secret-32-chars',
  ADMIN_BOOTSTRAP_EMAIL: 'admin@example.com',
  ADMIN_BOOTSTRAP_PASSWORD: 'ChangeMe123!',
};
for (const [key, value] of Object.entries(placeholders)) process.env[key] ||= value;
// Hợp đồng không phụ thuộc môi trường chạy script.
process.env.NODE_ENV = 'development';
process.env.SWAGGER_ENABLED = 'true';

const OUTPUT = resolve(import.meta.dirname, '../docs/openapi/openapi.json');

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, item]) => [key, sortKeys(item)]),
    );
  }
  return value;
}

interface BuiltApp {
  configureApp(app: unknown): void;
  buildOpenApiDocument(app: unknown): unknown;
  create(): Promise<{ close(): Promise<void> }>;
}

/** Import động từ `dist/` sau khi set env (ConfigModule đọc process.env khi nạp module). */
async function loadBuild(): Promise<BuiltApp> {
  const load = (file: string) => import(pathToFileURL(resolve(import.meta.dirname, '../dist', file)).href);
  const [{ NestFactory }, { AppModule }, { configureApp }, { buildOpenApiDocument }] = await Promise.all([
    import('@nestjs/core'),
    load('app.module.js'),
    load('bootstrap/configure-app.js'),
    load('bootstrap/openapi.js'),
  ]);
  return {
    configureApp,
    buildOpenApiDocument,
    create: () => NestFactory.create(AppModule, { logger: ['error'], abortOnError: false }),
  };
}

async function main() {
  const build = await loadBuild();
  const app = await build.create();
  try {
    build.configureApp(app);
    const document = build.buildOpenApiDocument(app);
    mkdirSync(dirname(OUTPUT), { recursive: true });
    writeFileSync(OUTPUT, `${JSON.stringify(sortKeys(document), null, 2)}\n`);
    console.log(`Wrote ${OUTPUT}`);
  } finally {
    await app.close();
  }
}

await main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
