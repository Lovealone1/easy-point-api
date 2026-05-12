import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({
    description: 'Name of the role',
    example: 'SUPERVISOR',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @ApiPropertyOptional({
    description: 'Description of the role and its responsibilities',
    example: 'Can approve discounts and view sensitive reports',
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;
}
