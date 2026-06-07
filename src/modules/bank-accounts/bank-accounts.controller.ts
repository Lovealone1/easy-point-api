import {
  Controller, Get, Post, Body, Patch, Param, Delete,
  UseGuards, Query, HttpCode, HttpStatus, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { BankAccountsService } from './bank-accounts.service.js';
import { CreateBankAccountDto } from './dto/create-bank-account.dto.js';
import { UpdateBankAccountDto } from './dto/update-bank-account.dto.js';
import { FindBankAccountsDto } from './dto/find-bank-accounts.dto.js';
import { ChangeBankAccountStatusDto } from './dto/change-bank-account-status.dto.js';
import { UploadQrCodeDto } from './dto/upload-qrcode.dto.js';
import {
  ApiTags, ApiOperation, ApiBearerAuth, ApiSecurity,
  ApiOkResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiTooManyRequestsResponse,
  ApiConsumes, ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { GlobalRole } from '@prisma/client';
import { PageDto } from '../../common/pagination/page.dto.js';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('Bank Accounts')
@ApiBearerAuth()
@Controller('bank-accounts')
export class BankAccountsController {
  constructor(private readonly bankAccountsService: BankAccountsService) {}

  @Get('global/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.ADMIN)
  @ApiOperation({ summary: 'Get all globally (Global Admin)' })
  @ApiOkResponse({ type: PageDto })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findAllGlobal(@Query() findOptionsDto: FindBankAccountsDto) {
    return this.bankAccountsService.findAll(findOptionsDto);
  }

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('bank_accounts:create')
  @ApiSecurity('x-organization-id')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create (Org Owner / Org Admin / Dynamic Role)' })
  @ApiCreatedResponse({ description: 'Created successfully.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  create(
    @Body() createBankAccountDto: CreateBankAccountDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.bankAccountsService.create(createBankAccountDto, file);
  }

  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('bank_accounts:read')
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'List paginated (Org Owner / Org Admin / Dynamic Role)' })
  @ApiOkResponse({ type: PageDto })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findAll(@Query() findOptionsDto: FindBankAccountsDto) {
    return this.bankAccountsService.findAll(findOptionsDto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('bank_accounts:read')
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Get by ID (Org Owner / Org Admin / Dynamic Role)' })
  @ApiOkResponse({ description: 'Record found.' })
  @ApiNotFoundResponse({ description: 'Not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findOne(@Param('id') id: string) {
    return this.bankAccountsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('bank_accounts:update')
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Update (Org Owner / Org Admin / Dynamic Role)' })
  @ApiOkResponse({ description: 'Updated successfully.' })
  @ApiNotFoundResponse({ description: 'Not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  update(@Param('id') id: string, @Body() updateBankAccountDto: UpdateBankAccountDto) {
    return this.bankAccountsService.update(id, updateBankAccountDto);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('bank_accounts:update')
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Change status (Org Owner / Org Admin / Dynamic Role)' })
  @ApiOkResponse({ description: 'Status updated.' })
  @ApiNotFoundResponse({ description: 'Not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  changeStatus(@Param('id') id: string, @Body() changeStatusDto: ChangeBankAccountStatusDto) {
    return this.bankAccountsService.changeStatus(id, changeStatusDto.status);
  }

  @Post(':id/qrcode')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('bank_accounts:update')
  @ApiSecurity('x-organization-id')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'QR Code file (WEBP, JPG, JPEG, PNG)',
    type: UploadQrCodeDto,
  })
  @ApiOperation({ summary: 'Upload QR code for bank account (Org Owner / Org Admin / Dynamic Role)' })
  @ApiOkResponse({ description: 'QR code uploaded successfully.' })
  @ApiNotFoundResponse({ description: 'Not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  uploadQrCode(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.bankAccountsService.uploadQrCode(id, file);
  }

  @Delete(':id/qrcode')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('bank_accounts:update')
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Delete QR code for bank account (Org Owner / Org Admin / Dynamic Role)' })
  @ApiOkResponse({ description: 'QR code deleted successfully.' })
  @ApiNotFoundResponse({ description: 'Not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  deleteQrCode(@Param('id') id: string) {
    return this.bankAccountsService.deleteQrCode(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('bank_accounts:delete')
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Delete (Org Owner / Org Admin / Dynamic Role)' })
  @ApiOkResponse({ description: 'Deleted successfully.' })
  @ApiNotFoundResponse({ description: 'Not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  remove(@Param('id') id: string) {
    return this.bankAccountsService.remove(id);
  }
}
