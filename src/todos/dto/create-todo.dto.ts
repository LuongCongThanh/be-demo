import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTodoDto {
	@ApiProperty({ maxLength: 255, example: 'Học NestJS cơ bản' })
	@IsNotEmpty()
	@IsString()
	@MaxLength(255)
	title: string;

	@ApiPropertyOptional({ example: 'Module, Controller, Service, DI, DTO' })
	@IsOptional()
	@IsString()
	description?: string;
}
