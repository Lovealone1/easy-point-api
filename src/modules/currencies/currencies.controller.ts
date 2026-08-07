import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse, ApiNotFoundResponse } from '@nestjs/swagger';
import { CurrenciesService } from './currencies.service.js';
import { FindCurrenciesDto } from './dto/find-currencies.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { AllowWithoutSubscription } from '../../common/decorators/allow-without-subscription.decorator.js';

@ApiTags('Currencies')
@Controller('currencies')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@AllowWithoutSubscription()
export class CurrenciesController {
  constructor(private readonly currenciesService: CurrenciesService) {}

  @Get()
  @ApiOperation({
    summary: 'List the ISO 4217 currency catalog',
    description:
      'Returns the full catalog unpaginated (~160 rows). Popular currencies come first so the client can render a pinned section without extra requests.',
  })
  @ApiOkResponse({ description: 'Currencies found.' })
  findAll(@Query() dto: FindCurrenciesDto) {
    return this.currenciesService.findAll(dto);
  }

  @Get(':code')
  @ApiOperation({ summary: 'Get a currency by its ISO 4217 alpha-3 code' })
  @ApiOkResponse({ description: 'Currency found.' })
  @ApiNotFoundResponse({ description: 'Currency not found.' })
  findOne(@Param('code') code: string) {
    return this.currenciesService.findByCode(code);
  }
}
