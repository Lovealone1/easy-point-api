import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsEmail,
  IsOptional,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  IsUUID,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BASE_MODULES_SELECTION_SIZE } from '../domain/base-modules.constants.js';

export class CreateMyOrganizationDto {
  @ApiProperty({ description: 'The name of the organization', example: 'Mi Tienda' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({ description: 'Contact email', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({
    description: `IDs de módulos base a activar. Debe contener exactamente ${BASE_MODULES_SELECTION_SIZE} módulos seleccionables (no de administración).`,
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(BASE_MODULES_SELECTION_SIZE)
  @ArrayMaxSize(BASE_MODULES_SELECTION_SIZE)
  @IsUUID('4', { each: true })
  moduleIds: string[];
}
