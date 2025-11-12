import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserContext } from '../common/interfaces/jwt-payload.interface';

@Controller()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

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
    return this.paymentsService.createCartPaymentIntent(
      user.organizationId!,
      user.id,
      dto,
    );
  }

  @Post('payments/stripe/webhook')
  @HttpCode(200)
  async stripeWebhook(
    // rawBody will be provided by express raw middleware
    @Req() req: any,
    @Headers('stripe-signature') signature: string,
  ) {
    await this.paymentsService.handleStripeWebhook(req.rawBody, signature);
    return { received: true };
  }
}
