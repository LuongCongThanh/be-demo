import { ConflictException, Injectable } from '@nestjs/common';
import type { OptionValue } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateOptionValueDto } from './dto/create-option-value.dto.js';
import { ListOptionValuesQueryDto } from './dto/list-option-values-query.dto.js';
import { UpdateOptionValueDto } from './dto/update-option-value.dto.js';

@Injectable()
export class OptionValuesService {
  constructor(private readonly prisma: PrismaService) {}

  // Pre-check chỉ để trả message rõ ràng; race giữa check và create vẫn bị
  // unique (type, code) chặn và filter map thành 409.
  async create(dto: CreateOptionValueDto): Promise<OptionValue> {
    const existing = await this.prisma.optionValue.findUnique({
      where: { type_code: { type: dto.type, code: dto.code } },
    });
    if (existing) {
      throw new ConflictException(`${dto.type} code "${dto.code}" already exists`);
    }
    const position = dto.position ?? (await this.nextPosition(dto));
    return this.prisma.optionValue.create({ data: { ...dto, position } });
  }

  findAll({ type, includeHidden }: ListOptionValuesQueryDto): Promise<OptionValue[]> {
    return this.prisma.optionValue.findMany({
      where: { ...(!includeHidden && { hidden: false }), ...(type && { type }) },
      orderBy: [{ type: 'asc' }, { position: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  update(id: string, dto: UpdateOptionValueDto): Promise<OptionValue> {
    return this.prisma.optionValue.update({ where: { id }, data: dto });
  }

  private async nextPosition({ type }: CreateOptionValueDto): Promise<number> {
    const { _max } = await this.prisma.optionValue.aggregate({ where: { type }, _max: { position: true } });
    return (_max.position ?? -1) + 1;
  }
}
