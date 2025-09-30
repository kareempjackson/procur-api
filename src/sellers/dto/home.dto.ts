import { ApiProperty } from '@nestjs/swagger';
import { DashboardMetricsDto } from './analytics.dto';
import { ProductResponseDto } from './product.dto';
import { OrderResponseDto } from './order.dto';

export class BuyerRequestSummaryDto {
  @ApiProperty({ description: 'Request ID' })
  id: string;

  @ApiProperty({ description: 'Request number' })
  request_number: string;

  @ApiProperty({ description: 'Product name' })
  product_name: string;

  @ApiProperty({ description: 'Quantity requested' })
  quantity: number;

  @ApiProperty({ description: 'Unit of measurement' })
  unit_of_measurement: string;

  @ApiProperty({ description: 'Buyer organization name' })
  buyer_name: string;

  @ApiProperty({ description: 'Location or city', required: false })
  location?: string;

  @ApiProperty({ description: 'Date needed', required: false })
  date_needed?: string;

  @ApiProperty({ description: 'Budget range text', required: false })
  budget_range_text?: string;

  @ApiProperty({ description: 'Priority label', required: false })
  priority?: 'high' | 'normal';
}

export class SellerHomeResponseDto {
  @ApiProperty({ description: 'Dashboard metrics' })
  metrics: DashboardMetricsDto;

  @ApiProperty({ description: 'Featured products' })
  featured_products: ProductResponseDto[];

  @ApiProperty({ description: 'Inventory list (top items or low stock)' })
  inventory: ProductResponseDto[];

  @ApiProperty({ description: 'Recent orders' })
  recent_orders: OrderResponseDto[];

  @ApiProperty({ description: 'Open buyer requests visible to this seller' })
  buyer_requests: BuyerRequestSummaryDto[];
}
