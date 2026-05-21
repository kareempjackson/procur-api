import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { AccountTypeGuard } from '../auth/guards/account-type.guard';
import { AccountTypes } from '../auth/decorators/account-types.decorator';
import { AccountType } from '../common/enums/account-type.enum';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserContext } from '../common/interfaces/jwt-payload.interface';
import { PaymentMethodsService } from './payment-methods.service';
import {
  ConfirmPaymentMethodDto,
  SavedPaymentMethodResponse,
  SetupIntentResponse,
} from './dto/payment-method.dto';

@ApiTags('Payment Methods')
@ApiBearerAuth('JWT-auth')
@Controller('payment-methods')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard, AccountTypeGuard)
@AccountTypes(AccountType.BUYER)
export class PaymentMethodsController {
  constructor(private readonly paymentMethods: PaymentMethodsService) {}

  @Get()
  @ApiOperation({ summary: 'List saved cards for the buyer organization' })
  @ApiResponse({ status: 200, type: [SavedPaymentMethodResponse] })
  list(@CurrentUser() user: UserContext): Promise<SavedPaymentMethodResponse[]> {
    return this.paymentMethods.listForOrganization(this.requireOrgId(user));
  }

  @Post('setup-intent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Create a Stripe SetupIntent for saving a new card',
    description:
      'Returns a client_secret the front-end uses to confirm card setup with Stripe Elements. The card is persisted via POST /payment-methods after Stripe confirmation.',
  })
  @ApiResponse({ status: 200, type: SetupIntentResponse })
  setupIntent(@CurrentUser() user: UserContext): Promise<SetupIntentResponse> {
    return this.paymentMethods.createSetupIntent(this.requireOrgId(user));
  }

  @Post()
  @ApiOperation({
    summary: 'Persist a confirmed PaymentMethod from Stripe to the buyer wallet',
  })
  @ApiResponse({ status: 201, type: SavedPaymentMethodResponse })
  confirm(
    @CurrentUser() user: UserContext,
    @Body() dto: ConfirmPaymentMethodDto,
  ): Promise<SavedPaymentMethodResponse> {
    return this.paymentMethods.confirmAndPersistPaymentMethod(
      this.requireOrgId(user),
      user.id,
      dto.stripe_payment_method_id,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a saved card from the buyer wallet' })
  async remove(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.paymentMethods.deletePaymentMethod(this.requireOrgId(user), id);
  }

  @Patch(':id/default')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Set a saved card as the buyer default' })
  async setDefault(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.paymentMethods.setDefault(this.requireOrgId(user), id);
  }

  private requireOrgId(user: UserContext): string {
    if (!user.organizationId) {
      throw new UnauthorizedException('User is not attached to an organization');
    }
    return user.organizationId;
  }
}
