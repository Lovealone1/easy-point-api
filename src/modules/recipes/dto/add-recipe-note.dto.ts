import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AddRecipeNoteDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  notes: string;
}
