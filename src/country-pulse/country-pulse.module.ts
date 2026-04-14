import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CountriesModule } from '../countries/countries.module';
import { CountryPulseService } from './country-pulse.service';
import { CountryPulseController } from './country-pulse.controller';
import { CountryPulseAdminController } from './country-pulse.admin.controller';

@Module({
  imports: [DatabaseModule, CountriesModule],
  controllers: [CountryPulseController, CountryPulseAdminController],
  providers: [CountryPulseService],
  exports: [CountryPulseService],
})
export class CountryPulseModule {}
