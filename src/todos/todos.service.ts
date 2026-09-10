import { Injectable, NotFoundException } from '@nestjs/common';
import type { Todo } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateTodoDto } from './dto/create-todo.dto.js';
import { UpdateTodoDto } from './dto/update-todo.dto.js';

@Injectable()
export class TodosService {
  constructor(private readonly prisma: PrismaService) {}

  create(createTodoDto: CreateTodoDto): Promise<Todo> {
    return this.prisma.todo.create({ data: createTodoDto });
  }

  findAll(): Promise<Todo[]> {
    return this.prisma.todo.findMany();
  }

  async findOne(id: number): Promise<Todo> {
    const todo = await this.prisma.todo.findUnique({ where: { id } });
    if (!todo) {
      throw new NotFoundException(`Todo #${id} not found`);
    }
    return todo;
  }

  async update(id: number, updateTodoDto: UpdateTodoDto): Promise<Todo> {
    await this.findOne(id); // ném 404 nếu không tồn tại
    return this.prisma.todo.update({ where: { id }, data: updateTodoDto });
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id); // ném 404 nếu không tồn tại
    await this.prisma.todo.delete({ where: { id } });
  }
}
