import { PartialType } from '@nestjs/swagger';
import { CreateRoleDto } from '#src/modules/identity/access/dto/admin/create-role.dto.js';

/** Every field optional; permissions, when sent, replace the whole set. */
export class UpdateRoleDto extends PartialType(CreateRoleDto) {}
