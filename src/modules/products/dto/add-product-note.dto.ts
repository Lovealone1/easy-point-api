import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AddProductNoteDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  notes: string;
}
