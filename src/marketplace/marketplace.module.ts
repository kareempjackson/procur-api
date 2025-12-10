import { Module } from '@nestjs/common';
import { MarketplaceController } from './marketplace.controller';
import { BuyersModule } from '../buyers/buyers.module';

@Module({
  imports: [BuyersModule],
  controllers: [MarketplaceController],
})
export class MarketplaceModule {}
