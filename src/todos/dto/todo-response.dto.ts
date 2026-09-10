import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TodoResponseDto {
	@ApiProperty({ example: 1 })
	id: number;

	@ApiProperty({ example: 'Học NestJS cơ bản' })
	title: string;

	@ApiPropertyOptional({ example: 'Module, Controller, Service, DI, DTO' })
	description?: string;

	@ApiProperty({ example: false })
	isDone: boolean;

	@ApiProperty({ example: '2026-09-09T10:00:00.000Z' })
	createdAt: Date;

	@ApiProperty({ example: '2026-09-09T10:00:00.000Z' })
	updatedAt: Date;
}
