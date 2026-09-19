import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * What a person may change about their own account.
 *
 * Deliberately not `UpdateUserDto`, which also carries `isActive`. That field
 * belongs to an administrator suspending somebody; reusing the DTO here would
 * let a user deactivate themselves through the profile form and then be unable
 * to sign back in to undo it.
 *
 * The email address is absent for a different reason: changing it requires
 * proving control of the new address, so it goes through the OTP pair on
 * AccountController rather than a plain PATCH.
 */
export class UpdateMyProfileDto {
  @ApiPropertyOptional({ example: 'John' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ example: '+573001234567' })
  @IsString()
  @IsOptional()
  @MaxLength(30)
  phoneNumber?: string;
}
