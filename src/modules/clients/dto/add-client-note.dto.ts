import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AddClientNoteDto {
  @ApiProperty({ description: 'The note content to store' })
  @IsNotEmpty()
  @IsString()
  notes: string;
}
