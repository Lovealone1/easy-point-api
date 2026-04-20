import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AddEmployeeNoteDto {
  @ApiProperty({ description: 'Note to append to the employee record' })
  @IsNotEmpty()
  @IsString()
  notes: string;
}
