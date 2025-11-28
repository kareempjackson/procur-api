import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { BankInfoService } from './bank-info.service';
import { BankInfoController } from './bank-info.controller';

@Module({
  imports: [DatabaseModule],
  providers: [BankInfoService],
  controllers: [BankInfoController],
  exports: [BankInfoService],
})
export class BankInfoModule {}
