import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { OrganizationConfigsService } from './organization-configs.service.js';
import { UpdateOrganizationConfigDto } from './dto/update-organization-config.dto.js';
import { UploadLogoDto } from './dto/upload-logo.dto.js';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiSecurity,
  ApiOkResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { OrgRolesGuard } from '../../common/guards/org-roles.guard.js';
import { OrgRoles } from '../../common/decorators/org-roles.decorator.js';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '../../common/enums/role.enum.js';

@ApiTags('Organization Configs')
@ApiBearerAuth()
@Controller('organization-configs')
export class OrganizationConfigsController {
  constructor(private readonly configsService: OrganizationConfigsService) {}

  @Get()
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Get organization config (Org Owner / Org Admin)' })
  @ApiOkResponse({ description: 'Configuration retrieved.' })
  getConfig() {
    return this.configsService.getConfig();
  }

  @Patch()
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({
    summary: 'Update organization config (Org Owner / Org Admin)',
  })
  @ApiOkResponse({ description: 'Configuration updated.' })
  updateConfig(@Body() updateDto: UpdateOrganizationConfigDto) {
    return this.configsService.updateConfig(updateDto);
  }

  @Post('logo')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Logo file (PNG or SVG)',
    type: UploadLogoDto,
  })
  @ApiOperation({ summary: 'Upload organization logo (Org Owner / Org Admin)' })
  @ApiOkResponse({ description: 'Logo uploaded and config updated.' })
  uploadLogo(@UploadedFile() file: Express.Multer.File) {
    return this.configsService.uploadLogo(file);
  }

  @Delete('logo')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Delete organization logo (Org Owner / Org Admin)' })
  @ApiOkResponse({ description: 'Logo deleted and config updated.' })
  deleteLogo() {
    return this.configsService.deleteLogo();
  }
}
