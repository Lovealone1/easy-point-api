import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiHeader, ApiOperation, ApiParam, ApiProduces, ApiSecurity, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RequireImportPermission } from '../../common/decorators/require-import-permission.decorator.js';
import { getImportDefinition } from './imports.types.js';
import { ImportsService } from './imports.service.js';

@ApiTags('Master imports')
@ApiBearerAuth()
@ApiSecurity('x-organization-id')
@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Get(':resource/import/template')
  @ApiOperation({ summary: 'Download a master-data import template' })
  @ApiParam({ name: 'resource', enum: ['clients', 'suppliers', 'employees', 'products', 'supplies', 'product-categories', 'expense-categories', 'transaction-categories'] })
  @ApiProduces('text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @RequireImportPermission()
  async template(@Param('resource') resource: string, @Query('format') format: string, @Res() response: Response) {
    this.assertResource(resource);
    const resolvedFormat = format === 'csv' ? 'csv' : 'xlsx';
    const file = this.importsService.template(resource, resolvedFormat);
    response.setHeader('Content-Type', file.contentType);
    response.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    response.send(file.buffer);
  }

  @Post(':resource/import/validate')
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiOperation({ summary: 'Validate a master-data import without writing' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  @RequireImportPermission()
  validate(@Param('resource') resource: string, @UploadedFile() file: Express.Multer.File) {
    this.assertResource(resource);
    if (!file) throw new BadRequestException('Debe enviar el archivo en el campo file');
    return this.importsService.validate(resource, file);
  }

  @Post(':resource/import')
  @HttpCode(HttpStatus.CREATED)
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiHeader({ name: 'x-idempotency-key', required: true })
  @ApiHeader({ name: 'x-import-file-hash', required: false })
  @ApiOperation({ summary: 'Create all valid master-data rows atomically' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  @RequireImportPermission()
  import(
    @Param('resource') resource: string,
    @UploadedFile() file: Express.Multer.File,
    @Headers('x-import-file-hash') expectedHash: string | undefined,
    @Headers('x-idempotency-key') idempotencyKey: string | undefined,
    @Req() request: any,
  ) {
    this.assertResource(resource);
    if (!file) throw new BadRequestException('Debe enviar el archivo en el campo file');
    return this.importsService.import(resource, file, expectedHash, idempotencyKey, request.user?.sub ?? request.user?.id);
  }

  private assertResource(resource: string): void {
    try { getImportDefinition(resource); } catch { throw new BadRequestException(`Recurso de importación no soportado: ${resource}`); }
  }
}
