import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AddSupplierNoteDto {
  @ApiProperty({ description: 'Note to append to the supplier record' })
  @IsNotEmpty()
  @IsString()
  notes: string;
}
