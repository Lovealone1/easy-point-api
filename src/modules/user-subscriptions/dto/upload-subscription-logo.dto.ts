import { ApiProperty } from '@nestjs/swagger';

/** Swagger-only shape so the multipart body renders as a file picker. */
export class UploadSubscriptionLogoDto {
  @ApiProperty({ type: 'string', format: 'binary' })
  file: any;
}
