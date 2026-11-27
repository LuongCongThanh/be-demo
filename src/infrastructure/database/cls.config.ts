import { ClsModule } from 'nestjs-cls';
import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { PrismaModule } from '#src/infrastructure/database/prisma.module.js';
import { PrismaService } from '#src/infrastructure/database/prisma.service.js';

/**
 * Một nơi cấu hình `ClsModule` + plugin giao dịch cho cả App (HTTP) và CLI để
 * hai bên không lệch nhau. Entry point HTTP bật middleware mở ngữ cảnh CLS cho
 * mỗi request; entry point không phải HTTP (CLI, scheduler, job) tự bọc việc
 * của mình trong `ClsService.run(...)`.
 */
export function createClsModule(opts: { mountMiddleware: boolean }) {
  return ClsModule.forRoot({
    global: true,
    middleware: { mount: opts.mountMiddleware },
    plugins: [
      new ClsPluginTransactional({
        imports: [PrismaModule],
        adapter: new TransactionalAdapterPrisma<PrismaService>({
          prismaInjectionToken: PrismaService,
          sqlFlavor: 'postgresql',
        }),
      }),
    ],
  });
}
