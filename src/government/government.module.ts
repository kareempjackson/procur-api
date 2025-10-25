import { Module } from '@nestjs/common';
import { GovernmentController } from './government.controller';
import { GovernmentService } from './government.service';
import { DatabaseModule } from '../database/database.module';
import { SellersModule } from '../sellers/sellers.module';

@Module({
  imports: [DatabaseModule, SellersModule],
  controllers: [GovernmentController],
  providers: [GovernmentService],
  exports: [GovernmentService],
})
export class GovernmentModule {}
