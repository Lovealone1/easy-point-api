import { Module } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import appConfig from '../../common/config/config.js';
import { FxRateService } from './fx-rate.service.js';
import { ExchangeRatesController } from './exchange-rates.controller.js';
import { ExchangeRatesRepository } from './exchange-rates.repository.js';
import { FX_PROVIDER, type FxProvider } from './providers/fx-provider.interface.js';
import { OpenErApiProvider } from './providers/open-er-api.provider.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { RedisModule } from '../../infraestructure/redis/redis.module.js';
import { CurrenciesModule } from '../currencies/currencies.module.js';

@Module({
  imports: [PrismaModule, RedisModule, CurrenciesModule],
  controllers: [ExchangeRatesController],
  providers: [
    FxRateService,
    ExchangeRatesRepository,
    {
      // Swapping in a keyed provider later is a single branch here.
      provide: FX_PROVIDER,
      useFactory: (config: ConfigType<typeof appConfig>): FxProvider => {
        switch (config.fx.provider) {
          case 'open-er-api':
            return new OpenErApiProvider(config.fx);
          default:
            throw new Error(`Unknown FX provider "${config.fx.provider}"`);
        }
      },
      inject: [appConfig.KEY],
    },
  ],
  exports: [FxRateService],
})
export class ExchangeRatesModule {}
