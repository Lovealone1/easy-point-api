import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUrl, Matches } from 'class-validator';

export class CreateSubscriptionProviderDto {
  @ApiProperty({ description: 'Identificador único en kebab-case (ej: netflix, spotify)' })
  @IsNotEmpty()
  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, { message: 'key debe estar en kebab-case' })
  key: string;

  @ApiProperty({ description: 'Nombre visible del servicio' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ description: 'ID de la categoría a la que pertenece' })
  @IsNotEmpty()
  @IsString()
  categoryId: string;

  @ApiPropertyOptional({ description: 'URL del logo del servicio' })
  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @ApiPropertyOptional({ description: 'Color de marca en hex' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'brandColor debe ser un hex válido, ej: #E50914' })
  brandColor?: string;

  @ApiPropertyOptional({ description: 'Sitio web oficial del servicio' })
  @IsOptional()
  @IsUrl()
  websiteUrl?: string;

  @ApiPropertyOptional({ description: 'Descripción corta del servicio' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Si el proveedor está activo en el catálogo', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Metadatos adicionales (ej: precios de referencia por tier)' })
  @IsOptional()
  metadata?: any;
}
