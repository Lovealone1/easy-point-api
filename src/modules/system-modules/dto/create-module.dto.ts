import { IsString, IsNotEmpty, IsOptional, IsInt, IsBoolean, IsArray, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { PermissionType } from '@prisma/client';

export class CreatePermissionDto {
  @ApiProperty({ example: 'sales:create' })
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty({ example: 'Crear venta' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Permite crear una venta en el sistema', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 'CRUD', enum: PermissionType })
  @IsEnum(PermissionType)
  type: PermissionType;

  @ApiProperty({ example: 0, required: false })
  @IsInt()
  @IsOptional()
  sortOrder?: number;
}

export class CreateFeatureDto {
  @ApiProperty({ example: 'sales.management' })
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty({ example: 'Gestión de Ventas' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Módulo principal de ventas', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 0, required: false })
  @IsInt()
  @IsOptional()
  sortOrder?: number;

  @ApiProperty({ type: [CreatePermissionDto], required: false })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreatePermissionDto)
  permissions?: CreatePermissionDto[];
}

export class CreateModuleDto {
  @ApiProperty({ example: 'sales' })
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty({ example: 'Ventas' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Módulo de administración de ventas', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 'shopping-cart', required: false })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiProperty({ example: 0, required: false })
  @IsInt()
  @IsOptional()
  sortOrder?: number;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ type: [CreateFeatureDto], required: false })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateFeatureDto)
  features?: CreateFeatureDto[];
}
