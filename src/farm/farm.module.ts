import { Module } from '@nestjs/common';
import { FarmController, FarmAdminController } from './farm.controller';
import { FarmService } from './farm.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [FarmController, FarmAdminController],
  providers: [FarmService],
  exports: [FarmService], // exported so SellersModule can inject FarmService for lot code assignment
})
export class FarmModule {}
