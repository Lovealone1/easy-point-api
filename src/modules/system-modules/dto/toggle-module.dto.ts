import { IsBoolean, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ToggleModuleDto {
  @ApiProperty({
    description: 'Estado activo/inactivo del módulo',
    example: true,
    type: Boolean,
  })
  @IsBoolean({ message: 'isActive debe ser un valor booleano' })
  @IsNotEmpty({ message: 'isActive no debe estar vacío' })
  isActive: boolean;
}
