import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Not paginated on purpose: the catalog is ~160 static rows, so the client
 * fetches it once and caches it forever rather than paging through it.
 */
export class FindCurrenciesDto {
  @ApiPropertyOptional({ description: 'Búsqueda por código, nombre o nombre en español' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Devolver solo las monedas destacadas' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  popularOnly?: boolean;

  @ApiPropertyOptional({ description: 'Incluir monedas desactivadas', default: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeInactive?: boolean;
}
