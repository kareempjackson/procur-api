import { Module } from '@nestjs/common';
import { BuyersController } from './buyers.controller';
import { BuyersService } from './buyers.service';
import { DatabaseModule } from '../database/database.module';
import { MessagesModule } from '../messages/messages.module';

@Module({
  imports: [DatabaseModule, MessagesModule],
  controllers: [BuyersController],
  providers: [BuyersService],
  exports: [BuyersService],
})
export class BuyersModule {}
