import { ApiProperty } from '@nestjs/swagger';

export class UploadLogoDto {
  @ApiProperty({ type: 'string', format: 'binary' })
  file: any;
}
