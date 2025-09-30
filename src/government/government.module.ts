import { Module } from '@nestjs/common';
import { GovernmentController } from './government.controller';
import { GovernmentService } from './government.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [GovernmentController],
  providers: [GovernmentService],
  exports: [GovernmentService],
})
export class GovernmentModule {}
