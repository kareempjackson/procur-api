import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { DisputesService } from './disputes.service';

@Module({
  imports: [DatabaseModule],
  providers: [DisputesService],
  exports: [DisputesService],
})
export class DisputesModule {}
