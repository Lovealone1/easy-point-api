import { ApiPropertyOptional } from '@nestjs/swagger';
import { OnboardingGoal, Theme } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Length, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { UpdateReminderPreferencesDto } from './update-reminder-preferences.dto.js';

/**
 * Everything the settings screen can change in one request. Extends the
 * reminder DTO so the wizard's per-step endpoints and the settings screen
 * share one set of validation rules.
 */
export class UpdateUserPreferencesDto extends UpdateReminderPreferencesDto {
  @ApiPropertyOptional({ enum: OnboardingGoal, description: 'Objetivo principal del usuario' })
  @IsOptional()
  @IsEnum(OnboardingGoal)
  goal?: OnboardingGoal;

  @ApiPropertyOptional({ description: 'Zona horaria IANA', example: 'America/Bogota' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ description: 'Moneda preferida para ver los totales (ISO 4217)', example: 'COP' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  preferredCurrency?: string;

  @ApiPropertyOptional({
    description: 'Color primario del panel personal, en hexadecimal de 6 dígitos',
    example: '#8b1fc1',
  })
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'primaryColor debe ser un hexadecimal de 6 dígitos, por ejemplo #8b1fc1',
  })
  primaryColor?: string;

  @ApiPropertyOptional({ enum: Theme, description: 'Tema por defecto del panel personal' })
  @IsOptional()
  @IsEnum(Theme)
  defaultTheme?: Theme;
}
