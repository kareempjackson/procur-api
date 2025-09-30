import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SellersModule } from './sellers/sellers.module';
import { BuyersModule } from './buyers/buyers.module';
import { GovernmentModule } from './government/government.module';
import { HomeModule } from './home/home.module';
import { MessagesModule } from './messages/messages.module';
import { DatabaseModule } from './database/database.module';
import { EmailModule } from './email/email.module';
import { AuthMiddleware } from './common/middleware/auth.middleware';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { PermissionsGuard } from './auth/guards/permissions.guard';
import { EmailVerifiedGuard } from './auth/guards/email-verified.guard';
import configuration from './config/configuration';
import { validate } from './config/validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
    }),
    DatabaseModule,
    EmailModule,
    AuthModule,
    UsersModule,
    SellersModule,
    BuyersModule,
    GovernmentModule,
    HomeModule,
    MessagesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: EmailVerifiedGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes('*');
  }
}
