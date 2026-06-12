import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignOrganizationModuleDto {
  @ApiProperty({
    description: 'ID de la organización (UUID)',
    example: 'd9b23b32-84e1-4c6e-82d7-cf237b678c1a',
    type: String,
  })
  @IsUUID('4', { message: 'El ID de la organización debe ser un UUID válido v4' })
  organizationId: string;

  @ApiProperty({
    description: 'ID del módulo (UUID) a asignar',
    example: 'f87a8b9c-d2e4-4d8e-a9d0-123456789abc',
    type: String,
  })
  @IsUUID('4', { message: 'El ID del módulo debe ser un UUID válido v4' })
  moduleId: string;
}
