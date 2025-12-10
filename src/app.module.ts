import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule, seconds } from '@nestjs/throttler';
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
import { NotificationsModule } from './notifications/notifications.module';
import { AuthMiddleware } from './common/middleware/auth.middleware';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { PermissionsGuard } from './auth/guards/permissions.guard';
import { EmailVerifiedGuard } from './auth/guards/email-verified.guard';
import configuration from './config/configuration';
import { PaymentsModule } from './payments/payments.module';
import { validate } from './config/validation';
import { FinanceModule } from './finance/finance.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { AiModule } from './ai/ai.module';
import { HealthController } from './health.controller';
import { AdminModule } from './admin/admin.module';
import { AuditModule } from './audit/audit.module';
import { BankInfoModule } from './bank-info/bank-info.module';
import { PaymentLinksModule } from './payment-links/payment-links.module';
import { MarketplaceModule } from './marketplace/marketplace.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: seconds(60),
          limit: 20,
        },
      ],
    }),
    DatabaseModule,
    EmailModule,
    NotificationsModule,
    AuthModule,
    UsersModule,
    SellersModule,
    BuyersModule,
    GovernmentModule,
    HomeModule,
    MessagesModule,
    PaymentsModule,
    FinanceModule,
    WhatsappModule,
    AiModule,
    AdminModule,
    AuditModule,
    BankInfoModule,
    PaymentLinksModule,
    MarketplaceModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
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
