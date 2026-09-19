import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { AllowWithoutSubscription } from '../../common/decorators/allow-without-subscription.decorator.js';
import { UserInfoService } from '../user-info/user-info.service.js';
import {
  CreatePersonaNaturalBillingDto,
  CreatePersonaJuridicaBillingDto,
} from '../user-info/dto/user-info-billing.dto.js';

/**
 * A person's own electronic-invoicing profile — the DIAN details that identify
 * them as the issuer: RUT, tax regime, resolution and numbering range.
 *
 * These were only ever reachable through `UserInfoController`, which is
 * `@Roles(GlobalRole.ADMIN)` and therefore behind the administration console.
 * That put a global administrator in the loop for data that belongs to the
 * account and that only its owner actually knows. The console keeps its view
 * for support; this is the same data, owned by the person it describes.
 *
 * Both halves call the same service, so the rule that an account holds either
 * a natural-person profile or a legal-person profile but never both is
 * enforced in one place regardless of who is editing.
 */
@ApiTags('Account Settings')
@ApiBearerAuth()
@Controller('me/billing')
@UseGuards(JwtAuthGuard)
@AllowWithoutSubscription()
export class AccountBillingController {
  constructor(private readonly userInfoService: UserInfoService) {}

  @Get()
  @ApiOperation({
    summary: 'Get my electronic-invoicing profile',
    description: 'Returns the natural-person or legal-person profile on this account, or none.',
  })
  @ApiOkResponse({ description: 'Billing profile returned.' })
  get(@CurrentUser('sub') userId: string) {
    return this.userInfoService.getBillingProfile(userId);
  }

  @Post('persona-natural')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Set up my billing profile as a natural person' })
  @ApiCreatedResponse({ description: 'Natural-person profile created.' })
  @ApiConflictResponse({ description: 'This account already has a billing profile.' })
  createPersonaNatural(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreatePersonaNaturalBillingDto,
  ) {
    return this.userInfoService.createPersonaNatural(userId, dto);
  }

  @Post('persona-juridica')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Set up my billing profile as a legal person' })
  @ApiCreatedResponse({ description: 'Legal-person profile created.' })
  @ApiConflictResponse({ description: 'This account already has a billing profile.' })
  createPersonaJuridica(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreatePersonaJuridicaBillingDto,
  ) {
    return this.userInfoService.createPersonaJuridica(userId, dto);
  }

  @Delete()
  @ApiOperation({
    summary: 'Remove my billing profile',
    description:
      'Deletes whichever profile is configured. Switching between natural and legal person means deleting and setting up again — they are different documents, not a field on one.',
  })
  @ApiOkResponse({ description: 'Billing profile removed.' })
  remove(@CurrentUser('sub') userId: string) {
    return this.userInfoService.deleteBillingProfile(userId);
  }
}
