import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  UseGuards,
  Get,
  Logger,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserContext } from '../common/interfaces/jwt-payload.interface';
import { Public } from '../auth/decorators/public.decorator';

@Controller()
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);
  constructor(private readonly paymentsService: PaymentsService) {}

  // Public config for client-side Stripe initialization
  @Public()
  @Get('payments/config')
  async getConfig() {
    this.logger.log('GET /payments/config');
    return {
      publishable_key: process.env.STRIPE_PUBLISHABLE_KEY || null,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('buyers/checkout/payment-intent')
  async createPaymentIntent(
    @CurrentUser() user: UserContext,
    @Body()
    dto: {
      shipping_address_id: string;
      billing_address_id?: string;
      buyer_notes?: string;
    },
  ) {
    this.logger.log(
      `POST /buyers/checkout/payment-intent buyer_org=${user.organizationId} buyer_user=${user.id} shipping=${dto?.shipping_address_id}`,
    );
    return this.paymentsService.createCartPaymentIntent(
      user.organizationId!,
      user.id,
      dto,
    );
  }

  @Public()
  @Post('payments/stripe/webhook')
  @HttpCode(200)
  async stripeWebhook(
    // rawBody will be provided by express raw middleware
    @Req() req: any,
    @Headers('stripe-signature') signature: string,
  ) {
    this.logger.log(
      `POST /payments/stripe/webhook signaturePresent=${Boolean(signature)}`,
    );
    await this.paymentsService.handleStripeWebhook(req.rawBody, signature);
    return { received: true };
  }
}
