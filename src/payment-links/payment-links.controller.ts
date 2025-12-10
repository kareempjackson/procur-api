import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  PaymentLinksService,
  OfflinePaymentMethod,
} from './payment-links.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { AccountTypeGuard } from '../auth/guards/account-type.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { UseGuards } from '@nestjs/common';
import { AccountTypes } from '../auth/decorators/account-types.decorator';
import { AccountType } from '../common/enums/account-type.enum';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserContext } from '../common/interfaces/jwt-payload.interface';
import { Public } from '../auth/decorators/public.decorator';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { IsArray, IsNumber, IsOptional, IsString, Min } from 'class-validator';

class CreatePaymentLinkForOrderDto {
  @IsString()
  order_id: string;

  @IsArray()
  @IsString({ each: true })
  allowed_payment_methods: OfflinePaymentMethod[];

  @IsOptional()
  @IsString()
  expires_at?: string;

  // Allow any buyer_contact shape; service will treat as snapshot
  @IsOptional()
  buyer_contact?: any;

  @IsOptional()
  platform_fee_amount?: number;

  @IsOptional()
  delivery_fee_amount_override?: number;

  @IsOptional()
  tax_amount_override?: number;

  @IsOptional()
  meta?: Record<string, any>;
}

class CreateOfflineOrderAndLinkDto {
  // Optional: known buyer org, or we’ll create a guest org
  @IsOptional()
  @IsString()
  buyer_org_id?: string;

  // Guest buyer details (used when buyer_org_id is not provided)
  @IsOptional()
  @IsString()
  buyer_name?: string;

  @IsOptional()
  @IsString()
  buyer_company?: string;

  @IsOptional()
  @IsString()
  buyer_business_type?: string;

  @IsOptional()
  @IsString()
  buyer_email?: string;

  @IsOptional()
  @IsString()
  buyer_phone?: string;

  // Simple shipping address snapshot
  @IsOptional()
  shipping_address?: any;

  // Line items (we’ll compute total_amount from quantity * unit_price per item)
  @IsOptional()
  line_items: any[];

  @IsOptional()
  currency?: string;

  @IsArray()
  @IsString({ each: true })
  allowed_payment_methods: OfflinePaymentMethod[];

  @IsOptional()
  @IsString()
  expires_at?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  delivery_date?: string;
}

/**
 * Seller-facing DTO for updating an existing offline order + payment link.
 * We keep most fields optional but expect the frontend to send a full
 * snapshot (buyer details, shipping address, line items, payment methods).
 */
class UpdateOfflineOrderAndLinkDto {
  @IsOptional()
  @IsString()
  buyer_name?: string;

  @IsOptional()
  @IsString()
  buyer_company?: string;

  @IsOptional()
  @IsString()
  buyer_business_type?: string;

  @IsOptional()
  @IsString()
  buyer_email?: string;

  @IsOptional()
  @IsString()
  buyer_phone?: string;

  @IsOptional()
  shipping_address?: any;

  @IsOptional()
  line_items?: any[];

  @IsOptional()
  currency?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowed_payment_methods?: OfflinePaymentMethod[];

  @IsOptional()
  @IsString()
  expires_at?: string | null;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  delivery_date?: string;
}

class PublicOfflinePaymentDto {
  @IsString()
  payment_method: OfflinePaymentMethod;

  @IsOptional()
  @IsString()
  payment_reference?: string;

  @IsOptional()
  @IsString()
  proof_url?: string;

  @IsOptional()
  buyer_contact?: any;
}

class ConfirmOfflinePaymentDto {
  @IsOptional()
  @IsString()
  payment_reference?: string;

  @IsOptional()
  @IsString()
  proof_url?: string;
}

class AdminCreateSimplePaymentLinkDto {
  @IsString()
  seller_org_id: string;

  @IsOptional()
  @IsString()
  buyer_org_id?: string;

  @IsOptional()
  @IsString()
  buyer_name?: string;

  @IsOptional()
  @IsString()
  buyer_company?: string;

  @IsOptional()
  @IsString()
  buyer_email?: string;

  @IsOptional()
  @IsString()
  buyer_phone?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @IsArray()
  @IsString({ each: true })
  allowed_payment_methods: OfflinePaymentMethod[];

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  expires_at?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  delivery_date?: string;

  @IsOptional()
  line_items?: {
    product_name: string;
    unit?: string;
    quantity: number;
    unit_price: number;
  }[];

  @IsOptional()
  shipping_address?: {
    line1: string;
    line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
}

@ApiTags('Payment Links')
@Controller()
export class PaymentLinksController {
  constructor(private readonly paymentLinks: PaymentLinksService) {}

  // ========== SELLER: Create payment link for an existing order ==========

  @UseGuards(
    JwtAuthGuard,
    EmailVerifiedGuard,
    AccountTypeGuard,
    PermissionsGuard,
  )
  @AccountTypes(AccountType.SELLER)
  @RequirePermissions('manage_orders')
  @Post('payment-links')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create payment link for order',
    description:
      'Create an offline payment link (bank transfer / cash / cheque) for an existing order belonging to this seller organization.',
  })
  @ApiBody({ type: CreatePaymentLinkForOrderDto })
  @ApiResponse({
    status: 201,
    description: 'Payment link created successfully',
  })
  async createForOrder(
    @CurrentUser() user: UserContext,
    @Body() body: CreatePaymentLinkForOrderDto,
  ) {
    return this.paymentLinks.createForOrder({
      sellerOrgId: user.organizationId!,
      orderId: body.order_id,
      createdByUserId: user.id,
      allowedPaymentMethods: body.allowed_payment_methods,
      expiresAt: body.expires_at,
      buyerContact: body.buyer_contact,
      platformFeeAmount: body.platform_fee_amount,
      deliveryFeeAmountOverride: body.delivery_fee_amount_override,
      taxAmountOverride: body.tax_amount_override,
      meta: body.meta,
    });
  }

  // ========== SELLER: Create offline order header + payment link ==========

  @UseGuards(
    JwtAuthGuard,
    EmailVerifiedGuard,
    AccountTypeGuard,
    PermissionsGuard,
  )
  @AccountTypes(AccountType.SELLER)
  @RequirePermissions('manage_orders')
  @Post('payment-links/offline-order')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create offline order and payment link',
    description:
      'Create a simple pending order (offline terms) and attach a payment link in a single step. Used by the seller dashboard modal.',
  })
  @ApiBody({ type: CreateOfflineOrderAndLinkDto })
  @ApiResponse({
    status: 201,
    description: 'Offline order and payment link created successfully',
  })
  async createOfflineOrderAndLink(
    @CurrentUser() user: UserContext,
    @Body() body: CreateOfflineOrderAndLinkDto,
  ) {
    return this.paymentLinks.createOrderAndLinkForSeller({
      sellerOrgId: user.organizationId!,
      // Either use the provided buyer_org_id, or let service create one
      buyerOrgId: body.buyer_org_id,
      buyerName: body.buyer_name,
      buyerCompany: body.buyer_company,
      buyerBusinessType: body.buyer_business_type,
      buyerEmail: body.buyer_email,
      buyerPhone: body.buyer_phone,
      shippingAddress: body.shipping_address,
      lineItems: body.line_items,
      currency: body.currency,
      allowedPaymentMethods: body.allowed_payment_methods,
      expiresAt: body.expires_at,
      notes: body.notes,
      deliveryDate: body.delivery_date,
      createdByUserId: user.id,
    });
  }

  // ========== SELLER: List payment links ==========

  @UseGuards(
    JwtAuthGuard,
    EmailVerifiedGuard,
    AccountTypeGuard,
    PermissionsGuard,
  )
  @AccountTypes(AccountType.SELLER)
  @RequirePermissions('manage_orders')
  @Get('payment-links')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'List payment links for seller',
    description:
      'Return all payment links created for this seller organization, newest first.',
  })
  async listForSeller(@CurrentUser() user: UserContext) {
    return this.paymentLinks.listForSeller(user.organizationId!);
  }

  // ========== SELLER: Update offline order + payment link ==========

  @UseGuards(
    JwtAuthGuard,
    EmailVerifiedGuard,
    AccountTypeGuard,
    PermissionsGuard,
  )
  @AccountTypes(AccountType.SELLER)
  @RequirePermissions('manage_orders')
  @Patch('payment-links/:id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update an existing offline order + payment link',
    description:
      'Allows a verified seller to update buyer details, shipping address, line items, allowed payment methods, and expiry for a non-final payment link.',
  })
  @ApiParam({ name: 'id', description: 'Payment link ID' })
  @ApiBody({ type: UpdateOfflineOrderAndLinkDto })
  async updateOfflineOrderAndLink(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateOfflineOrderAndLinkDto,
  ) {
    return this.paymentLinks.updateOfflineOrderAndLinkForSeller({
      sellerOrgId: user.organizationId!,
      paymentLinkId: id,
      buyerName: body.buyer_name,
      buyerCompany: body.buyer_company,
      buyerBusinessType: body.buyer_business_type,
      buyerEmail: body.buyer_email,
      buyerPhone: body.buyer_phone,
      shippingAddress: body.shipping_address,
      lineItems: body.line_items,
      currency: body.currency,
      allowedPaymentMethods: body.allowed_payment_methods,
      expiresAt: body.expires_at,
      notes: body.notes,
      deliveryDate: body.delivery_date,
      updatedByUserId: user.id,
    });
  }

  // ========== PUBLIC: Mini-site payload & offline payment selection ==========

  @Public()
  @Get('public/payment-links/:code')
  @ApiOperation({
    summary: 'Get public payment link payload',
    description:
      'Return the mini-site payload for a payment link, including order summary, fee breakdown, and allowed offline payment methods.',
  })
  @ApiParam({ name: 'code', description: 'Public payment link code' })
  async getPublicByCode(@Param('code') code: string) {
    return this.paymentLinks.getPublicByCode(code);
  }

  @Public()
  @Post('public/payment-links/:code/pay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Create offline payment intent from public link',
    description:
      'Buyer selects an offline payment method (bank transfer, cash on delivery, cheque) and optionally provides reference / proof and contact info.',
  })
  @ApiParam({ name: 'code', description: 'Public payment link code' })
  @ApiBody({ type: PublicOfflinePaymentDto })
  async createOfflinePaymentIntent(
    @Param('code') code: string,
    @Body() body: PublicOfflinePaymentDto,
  ) {
    return this.paymentLinks.createOfflinePaymentIntent({
      linkCode: code,
      paymentMethod: body.payment_method,
      paymentReference: body.payment_reference,
      proofUrl: body.proof_url,
      buyerContact: body.buyer_contact,
    });
  }

  // ========== ADMIN: Confirm offline payment ==========

  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, PermissionsGuard)
  @RequirePermissions('manage_payments')
  @Patch('admin/payment-links/:id/confirm-offline-payment')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Confirm offline payment for a payment link',
    description:
      'Admin confirms that an offline payment (bank transfer, cash, cheque) has been received. This marks the payment link and underlying order as paid.',
  })
  @ApiParam({ name: 'id', description: 'Payment link ID' })
  @ApiBody({ type: ConfirmOfflinePaymentDto })
  async confirmOfflinePayment(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ConfirmOfflinePaymentDto,
  ) {
    return this.paymentLinks.confirmOfflinePayment({
      paymentLinkId: id,
      adminUserId: user.id,
      paymentReference: body.payment_reference,
      proofUrl: body.proof_url,
    });
  }

  // ========== ADMIN: Create simple offline order + payment link for seller ==========

  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, PermissionsGuard)
  @RequirePermissions('manage_orders')
  @Post('admin/payment-links/offline-order')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create simple offline order and payment link for seller (admin)',
    description:
      'Admin creates a basic pending offline order and attached payment link on behalf of a seller organization.',
  })
  @ApiBody({ type: AdminCreateSimplePaymentLinkDto })
  async createSimpleOfflineOrderAndLinkForSeller(
    @CurrentUser() user: UserContext,
    @Body() body: AdminCreateSimplePaymentLinkDto,
  ) {
    const hasLineItems =
      Array.isArray(body.line_items) && body.line_items.length > 0;

    if (!hasLineItems && (body.amount == null || Number(body.amount) <= 0)) {
      throw new BadRequestException(
        'Either line_items must be provided or amount must be a positive number',
      );
    }

    const lineItems: {
      product_name: string;
      unit?: string;
      quantity: number;
      unit_price: number;
    }[] = hasLineItems
      ? body.line_items!
      : [
          {
            product_name: body.description || 'Offline order',
            unit: 'unit',
            quantity: 1,
            unit_price: Number(body.amount),
          },
        ];

    return this.paymentLinks.createOrderAndLinkForSeller({
      sellerOrgId: body.seller_org_id,
      buyerOrgId: body.buyer_org_id,
      buyerName: body.buyer_name,
      buyerCompany: body.buyer_company,
      buyerEmail: body.buyer_email,
      buyerPhone: body.buyer_phone,
      shippingAddress: body.shipping_address,
      lineItems,
      currency: body.currency,
      allowedPaymentMethods: body.allowed_payment_methods,
      expiresAt: body.expires_at,
      notes: body.notes,
      deliveryDate: body.delivery_date,
      createdByUserId: user.id,
    });
  }

  // ========== ADMIN: List payment links for a seller ==========

  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, PermissionsGuard)
  @RequirePermissions('manage_orders')
  @Get('admin/payment-links')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'List payment links for a seller (admin)',
    description:
      'Admin lists all payment links for a specific seller organization.',
  })
  async listPaymentLinksForSellerAdmin(
    @Query('seller_org_id') sellerOrgId?: string,
  ) {
    if (!sellerOrgId) {
      throw new BadRequestException('seller_org_id is required');
    }
    return this.paymentLinks.listForSeller(sellerOrgId);
  }
}
