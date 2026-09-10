import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
	adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
	await prisma.todo.createMany({
		data: [
			{ title: 'Học NestJS cơ bản', description: 'Module, Controller, Service, DI, DTO', isDone: true },
			{ title: 'Thêm Swagger', description: 'Viết OpenAPI docs cho API', isDone: true },
			{ title: 'Kết nối PostgreSQL qua Prisma', isDone: true },
			{ title: 'Viết unit test bằng Vitest' },
		],
	});
}

main()
	.then(() => console.log('Seed thành công'))
	.catch((err) => {
		console.error(err);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
