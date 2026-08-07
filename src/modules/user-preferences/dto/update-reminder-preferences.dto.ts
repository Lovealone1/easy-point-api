import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsObject, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Reminder settings are persisted so the wizard round-trips and the user's
 * choice survives, but nothing consumes them yet — the notification pipeline
 * is still a mock.
 */
export class UpdateReminderPreferencesDto {
  @ApiPropertyOptional({ description: '¿Quiere recibir recordatorios?', default: true })
  @IsOptional()
  @IsBoolean()
  remindersEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Días de antelación para avisar de una renovación', default: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(90)
  renewalReminderDaysBefore?: number;

  @ApiPropertyOptional({
    description: 'Canales de notificación (mock)',
    example: { push: true, email: false },
  })
  @IsOptional()
  @IsObject()
  reminderChannels?: Record<string, boolean>;

  @ApiPropertyOptional({ description: 'Hora de inicio del horario silencioso (0-23)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(23)
  quietHoursStart?: number;

  @ApiPropertyOptional({ description: 'Hora de fin del horario silencioso (0-23)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(23)
  quietHoursEnd?: number;
}
