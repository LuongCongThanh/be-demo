import type { Prisma } from '#src/generated/prisma/client.js';

export async function acquireCategoryLanguageWriteLock(tx: Prisma.TransactionClient): Promise<void> {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(724061320)::text`;
}
