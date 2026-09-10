import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TodosService } from './todos.service.js';
import { CreateTodoDto } from './dto/create-todo.dto.js';
import { UpdateTodoDto } from './dto/update-todo.dto.js';
import { TodoResponseDto } from './dto/todo-response.dto.js';

@ApiTags('todos')
@Controller('todos')
export class TodosController {
  constructor(private readonly todosService: TodosService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo todo mới' })
  @ApiResponse({ status: 201, description: 'Tạo thành công', type: TodoResponseDto })
  @ApiResponse({ status: 400, description: 'Validation fail (thiếu title, sai kiểu, hoặc thừa field)' })
  create(@Body() createTodoDto: CreateTodoDto) {
    return this.todosService.create(createTodoDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách toàn bộ todo' })
  @ApiResponse({ status: 200, description: 'Thành công', type: TodoResponseDto, isArray: true })
  findAll() {
    return this.todosService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy 1 todo theo id' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiResponse({ status: 200, description: 'Thành công', type: TodoResponseDto })
  @ApiResponse({ status: 404, description: 'Không tìm thấy todo' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.todosService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật 1 phần todo theo id' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công', type: TodoResponseDto })
  @ApiResponse({ status: 404, description: 'Không tìm thấy todo' })
  update(@Param('id', ParseIntPipe) id: number, @Body() updateTodoDto: UpdateTodoDto) {
    return this.todosService.update(id, updateTodoDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xoá 1 todo theo id' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiResponse({ status: 204, description: 'Xoá thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy todo' })
  remove(@Param('id', ParseIntPipe) id: number) {
    this.todosService.remove(id);
  }
}
