import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { StaffQueryFlagGuard } from '../auth/guards/staff-query-flag.guard.js';
import { OptionValuesService } from './option-values.service.js';
import { CreateOptionValueDto } from './dto/create-option-value.dto.js';
import { ListOptionValuesQueryDto } from './dto/list-option-values-query.dto.js';
import { OptionValueResponseDto } from './dto/option-value-response.dto.js';
import { UpdateOptionValueDto } from './dto/update-option-value.dto.js';

@ApiTags('Option Values')
@Controller('option-values')
export class OptionValuesController {
  constructor(private readonly optionValuesService: OptionValuesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STORE_MANAGER', 'MASTER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a color/size Option Value (STORE_MANAGER/MASTER_ADMIN only)' })
  @ApiCreatedResponse({ type: OptionValueResponseDto })
  create(@Body() dto: CreateOptionValueDto) {
    return this.optionValuesService.create(dto);
  }

  @Get()
  @UseGuards(StaffQueryFlagGuard('includeHidden'))
  @ApiOperation({
    summary: 'List Option Values in display order (public; includeHidden=true requires STORE_MANAGER/MASTER_ADMIN)',
  })
  @ApiOkResponse({ type: [OptionValueResponseDto] })
  findAll(@Query() query: ListOptionValuesQueryDto) {
    return this.optionValuesService.findAll(query);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STORE_MANAGER', 'MASTER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Rename, reorder or hide an Option Value — its code and type never change' })
  @ApiOkResponse({ type: OptionValueResponseDto })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateOptionValueDto) {
    return this.optionValuesService.update(id, dto);
  }
}
