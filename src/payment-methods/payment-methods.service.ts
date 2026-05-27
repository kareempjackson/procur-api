import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import { StripeService } from '../stripe/stripe.service';
import { SavedPaymentMethodResponse } from './dto/payment-method.dto';

interface PaymentMethodRow {
  id: string;
  organization_id: string;
  stripe_customer_id: string;
  stripe_payment_method_id: string;
  brand: string | null;
  last4: string | null;
  exp_month: number | null;
  exp_year: number | null;
  cardholder_name: string | null;
  is_default: boolean;
  created_by: string | null;
  created_at: string;
  detached_at: string | null;
}

@Injectable()
export class PaymentMethodsService {
  private readonly logger = new Logger(PaymentMethodsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly stripe: StripeService,
  ) {}

  /**
   * Lazily provision a Stripe Customer for the buyer organization. Race-safe via
   * UPDATE ... WHERE stripe_customer_id IS NULL: if two concurrent calls land,
   * the loser re-reads the winning value.
   */
  async ensureStripeCustomer(organizationId: string): Promise<string> {
    const client = this.supabase.getClient();

    const { data: org, error: orgErr } = await client
      .from('organizations')
      .select('id, name, stripe_customer_id')
      .eq('id', organizationId)
      .single();

    if (orgErr || !org) {
      throw new NotFoundException(`Organization ${organizationId} not found`);
    }
    if (org.stripe_customer_id) {
      // Self-heal: a cached customer id from a previous Stripe key/account/mode
      // will surface as `resource_missing` here. Drop the stale reference and
      // fall through to the create-new branch so the next setup-intent works
      // without manual DB cleanup. Any other Stripe error (network, auth, rate
      // limit) is genuinely fatal and re-thrown.
      try {
        const existing = await this.stripe.retrieveCustomer(
          org.stripe_customer_id,
        );
        // A deleted customer (deleted on the Stripe side, still has an ID we
        // can fetch but `deleted: true`) is also unusable — treat the same as
        // missing.
        if ((existing as { deleted?: boolean })?.deleted !== true) {
          return org.stripe_customer_id;
        }
        this.logger.warn(
          `Stripe customer ${org.stripe_customer_id} on org ${organizationId} is deleted; recreating`,
        );
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code;
        if (code === 'resource_missing') {
          this.logger.warn(
            `Stripe customer ${org.stripe_customer_id} on org ${organizationId} missing under current key; recreating`,
          );
        } else {
          throw err;
        }
      }

      // Null out the stale id so the UPDATE ... WHERE stripe_customer_id IS NULL
      // race-guard below still works for a recreated customer.
      await client
        .from('organizations')
        .update({ stripe_customer_id: null })
        .eq('id', organizationId);
    }

    // Pick a representative email: the first admin/owner of the org.
    const { data: orgUser } = await client
      .from('organization_users')
      .select('users!inner(email)')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    const email =
      (orgUser?.users as unknown as { email?: string })?.email ||
      `org-${organizationId}@procur.placeholder`;

    const customer = await this.stripe.createCustomer({
      email,
      name: org.name,
      organizationId,
    });

    const { data: updated, error: updateErr } = await client
      .from('organizations')
      .update({ stripe_customer_id: customer.id })
      .eq('id', organizationId)
      .is('stripe_customer_id', null)
      .select('stripe_customer_id')
      .maybeSingle();

    if (updateErr) {
      throw new BadRequestException(
        `Failed to persist Stripe customer: ${updateErr.message}`,
      );
    }

    if (updated?.stripe_customer_id) return updated.stripe_customer_id;

    // Lost the race — re-read the winning customer id and discard our duplicate.
    this.logger.warn(
      `Concurrent stripe customer create for org ${organizationId}; discarding ${customer.id}`,
    );
    const { data: refetched } = await client
      .from('organizations')
      .select('stripe_customer_id')
      .eq('id', organizationId)
      .single();
    if (!refetched?.stripe_customer_id) {
      throw new BadRequestException('Stripe customer race resolution failed');
    }
    return refetched.stripe_customer_id;
  }

  async listForOrganization(
    organizationId: string,
  ): Promise<SavedPaymentMethodResponse[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('payment_methods')
      .select('*')
      .eq('organization_id', organizationId)
      .is('detached_at', null)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException(error.message);
    }
    return (data || []).map((row: PaymentMethodRow) => this.toResponse(row));
  }

  async createSetupIntent(organizationId: string) {
    const customerId = await this.ensureStripeCustomer(organizationId);
    const setupIntent = await this.stripe.createSetupIntent(customerId);
    if (!setupIntent.client_secret) {
      throw new BadRequestException('Stripe did not return a client secret');
    }
    return { client_secret: setupIntent.client_secret, customer_id: customerId };
  }

  async confirmAndPersistPaymentMethod(
    organizationId: string,
    userId: string,
    stripePaymentMethodId: string,
  ): Promise<SavedPaymentMethodResponse> {
    const customerId = await this.ensureStripeCustomer(organizationId);

    const pm = await this.stripe.retrievePaymentMethod(stripePaymentMethodId);
    if (pm.type !== 'card' || !pm.card) {
      throw new BadRequestException('Only card payment methods are supported');
    }
    if (pm.customer && pm.customer !== customerId) {
      throw new ForbiddenException(
        'Payment method belongs to a different Stripe customer',
      );
    }
    if (!pm.customer) {
      await this.stripe.attachPaymentMethod(stripePaymentMethodId, customerId);
    }

    const client = this.supabase.getClient();

    const { count } = await client
      .from('payment_methods')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .is('detached_at', null);
    const isFirst = (count ?? 0) === 0;

    const { data: inserted, error } = await client
      .from('payment_methods')
      .insert({
        organization_id: organizationId,
        stripe_customer_id: customerId,
        stripe_payment_method_id: stripePaymentMethodId,
        brand: pm.card.brand,
        last4: pm.card.last4,
        exp_month: pm.card.exp_month,
        exp_year: pm.card.exp_year,
        cardholder_name: pm.billing_details?.name ?? null,
        is_default: isFirst,
        created_by: userId,
      })
      .select('*')
      .single();

    if (error) {
      throw new BadRequestException(`Failed to save payment method: ${error.message}`);
    }
    if (isFirst) {
      await this.stripe.setDefaultPaymentMethod(customerId, stripePaymentMethodId);
    }
    return this.toResponse(inserted as PaymentMethodRow);
  }

  async deletePaymentMethod(organizationId: string, paymentMethodId: string) {
    const row = await this.getOwned(organizationId, paymentMethodId);

    try {
      await this.stripe.detachPaymentMethod(row.stripe_payment_method_id);
    } catch (err) {
      // If Stripe says it's already detached, continue with the soft-delete.
      this.logger.warn(`Stripe detach failed for ${row.stripe_payment_method_id}: ${err}`);
    }

    const { error } = await this.supabase
      .getClient()
      .from('payment_methods')
      .update({ detached_at: new Date().toISOString(), is_default: false })
      .eq('id', paymentMethodId);

    if (error) throw new BadRequestException(error.message);
  }

  async setDefault(organizationId: string, paymentMethodId: string) {
    const row = await this.getOwned(organizationId, paymentMethodId);
    const client = this.supabase.getClient();

    const { error: clearErr } = await client
      .from('payment_methods')
      .update({ is_default: false })
      .eq('organization_id', organizationId)
      .eq('is_default', true);
    if (clearErr) throw new BadRequestException(clearErr.message);

    const { error: setErr } = await client
      .from('payment_methods')
      .update({ is_default: true })
      .eq('id', paymentMethodId);
    if (setErr) throw new BadRequestException(setErr.message);

    await this.stripe.setDefaultPaymentMethod(
      row.stripe_customer_id,
      row.stripe_payment_method_id,
    );
  }

  /**
   * Used by createOrder to verify that a buyer can charge a given Stripe PaymentMethod —
   * prevents a buyer from passing in a PM that belongs to another org's customer.
   */
  async verifyOwnership(
    organizationId: string,
    stripePaymentMethodId: string,
  ): Promise<{ stripeCustomerId: string; stripePaymentMethodId: string }> {
    const { data, error } = await this.supabase
      .getClient()
      .from('payment_methods')
      .select('stripe_customer_id, stripe_payment_method_id')
      .eq('organization_id', organizationId)
      .eq('stripe_payment_method_id', stripePaymentMethodId)
      .is('detached_at', null)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) {
      throw new ForbiddenException(
        'Payment method does not belong to this organization',
      );
    }
    return {
      stripeCustomerId: data.stripe_customer_id,
      stripePaymentMethodId: data.stripe_payment_method_id,
    };
  }

  /**
   * Resolve a Stripe PaymentMethod for use in a charge. Handles both flows:
   *  - Saved-card: the PM is already in payment_methods for this org → return it.
   *  - New-card: the PM was just minted client-side via Stripe.js → ensure the
   *    org has a Stripe customer, attach the PM to that customer (or assert it
   *    isn't bound elsewhere), and return the resolved (customer, pm) pair.
   *
   * Does NOT persist a payment_methods row — call {@link persistAfterCharge}
   * after the charge succeeds if `save_payment_method` was requested.
   */
  async resolveForCharge(
    organizationId: string,
    stripePaymentMethodId: string,
  ): Promise<{
    stripeCustomerId: string;
    stripePaymentMethodId: string;
    isNew: boolean;
  }> {
    // Saved-card fast path
    const { data: existing, error } = await this.supabase
      .getClient()
      .from('payment_methods')
      .select('id, stripe_customer_id, stripe_payment_method_id')
      .eq('organization_id', organizationId)
      .eq('stripe_payment_method_id', stripePaymentMethodId)
      .is('detached_at', null)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (existing) {
      // Self-heal: a Stripe key rotation (or account switch) will leave saved
      // payment_methods rows pointing at PM ids that no longer exist on
      // Stripe's side. Without this check, the order flow would later raise
      // `Card declined (resource_missing): No such PaymentMethod` deep inside
      // createPaymentIntent. Catch it here, soft-detach the orphaned row, and
      // surface a friendly "please re-add" error to the buyer instead.
      try {
        await this.stripe.retrievePaymentMethod(stripePaymentMethodId);
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code;
        if (code === 'resource_missing') {
          this.logger.warn(
            `Stripe PM ${stripePaymentMethodId} on org ${organizationId} missing under current key; soft-detaching local row`,
          );
          await this.supabase
            .getClient()
            .from('payment_methods')
            .update({ detached_at: new Date().toISOString() })
            .eq('id', existing.id);
          throw new BadRequestException(
            'This saved card is no longer valid. Please re-add the card and try again.',
          );
        }
        throw err;
      }
      return {
        stripeCustomerId: existing.stripe_customer_id,
        stripePaymentMethodId: existing.stripe_payment_method_id,
        isNew: false,
      };
    }

    // New-card path: attach to this org's Stripe customer.
    const customerId = await this.ensureStripeCustomer(organizationId);
    const pm = await this.stripe.retrievePaymentMethod(stripePaymentMethodId);
    if (pm.type !== 'card' || !pm.card) {
      throw new BadRequestException('Only card payment methods are supported');
    }
    if (pm.customer && pm.customer !== customerId) {
      // PM is bound to a different Stripe customer — that's a real ownership
      // mismatch (e.g. PM-stuffing attempt), not just a "new card."
      throw new ForbiddenException(
        'Payment method belongs to a different Stripe customer',
      );
    }
    if (!pm.customer) {
      await this.stripe.attachPaymentMethod(stripePaymentMethodId, customerId);
    }
    return {
      stripeCustomerId: customerId,
      stripePaymentMethodId,
      isNew: true,
    };
  }

  /**
   * Persist a payment_methods row for a PM that was just charged via the
   * new-card path. Idempotent: a duplicate row for the same (org, pm) is
   * silently ignored.
   */
  async persistAfterCharge(input: {
    organizationId: string;
    userId: string;
    stripePaymentMethodId: string;
    stripeCustomerId: string;
  }): Promise<SavedPaymentMethodResponse | null> {
    const client = this.supabase.getClient();

    // Skip if already persisted (e.g. retry after 3DS).
    const { data: dup } = await client
      .from('payment_methods')
      .select('*')
      .eq('organization_id', input.organizationId)
      .eq('stripe_payment_method_id', input.stripePaymentMethodId)
      .is('detached_at', null)
      .maybeSingle();
    if (dup) return this.toResponse(dup as PaymentMethodRow);

    const pm = await this.stripe.retrievePaymentMethod(
      input.stripePaymentMethodId,
    );
    if (pm.type !== 'card' || !pm.card) return null;

    const { count } = await client
      .from('payment_methods')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', input.organizationId)
      .is('detached_at', null);
    const isFirst = (count ?? 0) === 0;

    const { data: inserted, error } = await client
      .from('payment_methods')
      .insert({
        organization_id: input.organizationId,
        stripe_customer_id: input.stripeCustomerId,
        stripe_payment_method_id: input.stripePaymentMethodId,
        brand: pm.card.brand,
        last4: pm.card.last4,
        exp_month: pm.card.exp_month,
        exp_year: pm.card.exp_year,
        cardholder_name: pm.billing_details?.name ?? null,
        is_default: isFirst,
        created_by: input.userId,
      })
      .select('*')
      .single();

    if (error) {
      // Non-fatal: charge already succeeded; surface as a warning.
      this.logger.warn(
        `Charge succeeded but failed to persist payment method ${input.stripePaymentMethodId}: ${error.message}`,
      );
      return null;
    }
    if (isFirst) {
      try {
        await this.stripe.setDefaultPaymentMethod(
          input.stripeCustomerId,
          input.stripePaymentMethodId,
        );
      } catch (e) {
        this.logger.warn(`Failed to set default PM in Stripe: ${e}`);
      }
    }
    return this.toResponse(inserted as PaymentMethodRow);
  }

  private async getOwned(
    organizationId: string,
    paymentMethodId: string,
  ): Promise<PaymentMethodRow> {
    const { data, error } = await this.supabase
      .getClient()
      .from('payment_methods')
      .select('*')
      .eq('id', paymentMethodId)
      .eq('organization_id', organizationId)
      .is('detached_at', null)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException(`Payment method ${paymentMethodId} not found`);
    return data as PaymentMethodRow;
  }

  private toResponse(row: PaymentMethodRow): SavedPaymentMethodResponse {
    return {
      id: row.id,
      stripe_payment_method_id: row.stripe_payment_method_id,
      brand: row.brand,
      last4: row.last4,
      exp_month: row.exp_month,
      exp_year: row.exp_year,
      cardholder_name: row.cardholder_name,
      is_default: row.is_default,
      created_at: row.created_at,
    };
  }
}
