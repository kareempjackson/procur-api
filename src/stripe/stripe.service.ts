import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

export interface CreatePaymentIntentParams {
  amountCents: number;
  currency: string;
  customerId: string;
  paymentMethodId: string;
  idempotencyKey: string;
  metadata?: Record<string, string>;
  setupFutureUsage?: boolean;
  description?: string;
}

export interface CreateRefundParams {
  paymentIntentId: string;
  amountCents: number;
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
  metadata?: Record<string, string>;
  idempotencyKey: string;
}

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;

  constructor(private readonly configService: ConfigService) {
    const secretKey = this.configService.get<string>('stripe.secretKey');
    const webhookSecret = this.configService.get<string>('stripe.webhookSecret');

    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is required to initialize StripeService');
    }

    this.stripe = new Stripe(secretKey, {
      apiVersion: '2024-12-18.acacia' as Stripe.LatestApiVersion,
      typescript: true,
      maxNetworkRetries: 2,
    });
    this.webhookSecret = webhookSecret || '';

    this.logger.log('Stripe client initialized');
  }

  // -- Customers ----------------------------------------------------------

  async createCustomer(params: {
    email: string;
    name?: string;
    organizationId: string;
  }): Promise<Stripe.Customer> {
    return this.stripe.customers.create({
      email: params.email,
      name: params.name,
      metadata: { organization_id: params.organizationId },
    });
  }

  async retrieveCustomer(customerId: string): Promise<Stripe.Customer | Stripe.DeletedCustomer> {
    return this.stripe.customers.retrieve(customerId);
  }

  // -- Payment methods (saved cards) -------------------------------------

  async createSetupIntent(customerId: string): Promise<Stripe.SetupIntent> {
    return this.stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      usage: 'off_session',
    });
  }

  async retrievePaymentMethod(paymentMethodId: string): Promise<Stripe.PaymentMethod> {
    return this.stripe.paymentMethods.retrieve(paymentMethodId);
  }

  async attachPaymentMethod(
    paymentMethodId: string,
    customerId: string,
  ): Promise<Stripe.PaymentMethod> {
    return this.stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
  }

  async detachPaymentMethod(paymentMethodId: string): Promise<Stripe.PaymentMethod> {
    return this.stripe.paymentMethods.detach(paymentMethodId);
  }

  async setDefaultPaymentMethod(
    customerId: string,
    paymentMethodId: string,
  ): Promise<Stripe.Customer> {
    return this.stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });
  }

  async listPaymentMethods(customerId: string): Promise<Stripe.PaymentMethod[]> {
    const result = await this.stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });
    return result.data;
  }

  // -- Payment intents ----------------------------------------------------

  async createPaymentIntent(
    params: CreatePaymentIntentParams,
  ): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.create(
      {
        amount: params.amountCents,
        currency: params.currency,
        customer: params.customerId,
        payment_method: params.paymentMethodId,
        confirm: true,
        capture_method: 'automatic',
        off_session: false,
        setup_future_usage: params.setupFutureUsage ? 'off_session' : undefined,
        automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
        metadata: params.metadata,
        description: params.description,
      },
      { idempotencyKey: params.idempotencyKey },
    );
  }

  async retrievePaymentIntent(
    paymentIntentId: string,
  ): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ['latest_charge'],
    });
  }

  // -- Refunds ------------------------------------------------------------

  async createRefund(params: CreateRefundParams): Promise<Stripe.Refund> {
    return this.stripe.refunds.create(
      {
        payment_intent: params.paymentIntentId,
        amount: params.amountCents,
        reason: params.reason,
        metadata: params.metadata,
      },
      { idempotencyKey: params.idempotencyKey },
    );
  }

  async retrieveRefund(refundId: string): Promise<Stripe.Refund> {
    return this.stripe.refunds.retrieve(refundId);
  }

  // -- Webhooks -----------------------------------------------------------

  constructWebhookEvent(rawBody: Buffer | string, signature: string): Stripe.Event {
    if (!this.webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
    }
    return this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
  }
}
