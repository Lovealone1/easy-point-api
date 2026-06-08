import { IsArray, IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignModulesDto {
  @ApiProperty({
    description: 'IDs of the modules to assign/enable for the organization',
    type: [String],
    example: ['mod-uuid-1', 'mod-uuid-2'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  moduleIds: string[];
}
