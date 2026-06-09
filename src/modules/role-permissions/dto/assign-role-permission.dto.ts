import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignRolePermissionDto {
  @ApiProperty({
    description: 'ID del rol (UUID) al que se le asignará el permiso',
    example: 'd9b23b32-84e1-4c6e-82d7-cf237b678c1a',
    type: String,
  })
  @IsUUID('4', { message: 'El ID del rol debe ser un UUID válido v4' })
  roleId: string;

  @ApiProperty({
    description: 'ID del permiso (UUID) a asignar',
    example: 'f87a8b9c-d2e4-4d8e-a9d0-123456789abc',
    type: String,
  })
  @IsUUID('4', { message: 'El ID del permiso debe ser un UUID válido v4' })
  permissionId: string;
}
