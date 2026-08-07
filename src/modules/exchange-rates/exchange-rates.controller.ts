import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse, ApiServiceUnavailableResponse } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { FxRateService } from './fx-rate.service.js';
import { ConvertCurrencyDto } from './dto/convert-currency.dto.js';
import { GetLatestRatesDto } from './dto/get-latest-rates.dto.js';
import { CurrenciesService } from '../currencies/currencies.service.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { AllowWithoutSubscription } from '../../common/decorators/allow-without-subscription.decorator.js';

@ApiTags('Exchange Rates')
@Controller('exchange-rates')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@AllowWithoutSubscription()
export class ExchangeRatesController {
  constructor(
    private readonly fxRateService: FxRateService,
    private readonly currenciesService: CurrenciesService,
  ) {}

  @Get('latest')
  @ApiOperation({
    summary: 'Latest exchange rates for a base currency',
    description:
      'Rates By Exchange Rate API (https://www.exchangerate-api.com). Refreshed once a day and cached; `stale` marks a table served past its refresh window.',
  })
  @ApiOkResponse({ description: 'Rates found.' })
  async getLatest(@Query() dto: GetLatestRatesDto) {
    if (dto.base) await this.currenciesService.assertExists(dto.base);

    const { table, stale, unavailable } = await this.fxRateService.getRates(dto.base);

    return {
      base: table?.base ?? dto.base ?? null,
      rates: table?.rates ?? null,
      ratesAsOf: table?.ratesAsOf ?? null,
      nextUpdateAt: table?.nextUpdateAt ?? null,
      stale,
      unavailable,
      attribution: this.fxRateService.attribution,
    };
  }

  @Get('convert')
  @ApiOperation({
    summary: 'Convert an amount between two currencies',
    description:
      'Rates By Exchange Rate API (https://www.exchangerate-api.com). The result is rounded to the target currency\'s ISO minor unit.',
  })
  @ApiOkResponse({ description: 'Conversion performed.' })
  @ApiServiceUnavailableResponse({ description: 'No rates available for this pair.' })
  async convert(@Query() dto: ConvertCurrencyDto) {
    await this.currenciesService.assertExists(dto.from);
    const target = await this.currenciesService.assertExists(dto.to);

    const result = await this.fxRateService.convert(
      new Prisma.Decimal(dto.amount),
      dto.from,
      dto.to,
      target.decimalDigits,
    );

    if (!result) {
      throw new BadRequestException(
        `No hay tasa de cambio disponible para ${dto.from} → ${dto.to} en este momento.`,
      );
    }

    return {
      from: dto.from,
      to: dto.to,
      amount: dto.amount,
      converted: result.amount.toFixed(target.decimalDigits),
      rate: result.rate.toFixed(8),
      ratesAsOf: result.ratesAsOf,
      stale: result.stale,
      attribution: this.fxRateService.attribution,
    };
  }
}
