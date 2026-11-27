import { NestFactory } from '@nestjs/core';
import { ClsService } from 'nestjs-cls';
import { CliModule } from '#src/cli/cli.module.js';
import { CreateAdminCommand } from '#src/cli/create-admin.command.js';

const COMMANDS = { 'create-admin': CreateAdminCommand } as const;

async function main(): Promise<number> {
  const [name, ...args] = process.argv.slice(2);
  const command = COMMANDS[name as keyof typeof COMMANDS];
  if (!command) {
    console.error(`Unknown command "${name ?? ''}". Available: ${Object.keys(COMMANDS).join(', ')}`);
    return 2;
  }

  const app = await NestFactory.createApplicationContext(CliModule, { logger: ['error', 'warn'] });
  try {
    // Ngữ cảnh CLS để `TransactionHost.tx` hoạt động ngoài HTTP.
    return await app.get(ClsService).run(() => app.get(command).run(args));
  } finally {
    await app.close();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
