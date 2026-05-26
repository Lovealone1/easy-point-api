import { ApiProperty } from '@nestjs/swagger';

export class UploadQrCodeDto {
  @ApiProperty({ type: 'string', format: 'binary' })
  file: any;
}
