import { IsOptional, IsDateString, IsEnum, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum AnalyticsPeriod {
  TODAY = 'today',
  YESTERDAY = 'yesterday',
  LAST_7_DAYS = 'last_7_days',
  LAST_30_DAYS = 'last_30_days',
  LAST_90_DAYS = 'last_90_days',
  THIS_MONTH = 'this_month',
  LAST_MONTH = 'last_month',
  THIS_YEAR = 'this_year',
  CUSTOM = 'custom',
}

export class AnalyticsQueryDto {
  @ApiPropertyOptional({
    description: 'Analytics period',
    enum: AnalyticsPeriod,
    default: AnalyticsPeriod.LAST_30_DAYS,
  })
  @IsOptional()
  @IsEnum(AnalyticsPeriod)
  period?: AnalyticsPeriod = AnalyticsPeriod.LAST_30_DAYS;

  @ApiPropertyOptional({
    description: 'Start date for custom period (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  start_date?: string;

  @ApiPropertyOptional({
    description: 'End date for custom period (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  end_date?: string;

  @ApiPropertyOptional({
    description: 'Group by time interval',
    enum: ['day', 'week', 'month'],
  })
  @IsOptional()
  @IsString()
  group_by?: 'day' | 'week' | 'month';
}

export class DashboardMetricsDto {
  @ApiProperty({ description: 'Total revenue for the period' })
  total_revenue: number;

  @ApiProperty({ description: 'Total orders for the period' })
  total_orders: number;

  @ApiProperty({ description: 'Total products sold' })
  total_products_sold: number;

  @ApiProperty({ description: 'Average order value' })
  average_order_value: number;

  @ApiProperty({ description: 'Pending orders count' })
  pending_orders: number;

  @ApiProperty({ description: 'Active products count' })
  active_products: number;

  @ApiProperty({ description: 'Low stock products count' })
  low_stock_products: number;

  @ApiProperty({ description: 'Out of stock products count' })
  out_of_stock_products: number;

  @ApiProperty({
    description: 'Revenue growth percentage compared to previous period',
  })
  revenue_growth: number;

  @ApiProperty({
    description: 'Orders growth percentage compared to previous period',
  })
  orders_growth: number;

  @ApiProperty({ description: 'Top selling product' })
  top_selling_product: {
    id: string;
    name: string;
    quantity_sold: number;
    revenue: number;
  };

  @ApiProperty({ description: 'Currency' })
  currency: string;

  @ApiProperty({ description: 'Period start date' })
  period_start: string;

  @ApiProperty({ description: 'Period end date' })
  period_end: string;
}

export class SalesAnalyticsDto {
  @ApiProperty({ description: 'Daily/weekly/monthly sales data' })
  sales_data: Array<{
    date: string;
    revenue: number;
    orders_count: number;
    products_sold: number;
  }>;

  @ApiProperty({ description: 'Sales by category' })
  sales_by_category: Array<{
    category: string;
    revenue: number;
    orders_count: number;
    percentage: number;
  }>;

  @ApiProperty({ description: 'Sales by product' })
  top_products: Array<{
    product_id: string;
    product_name: string;
    quantity_sold: number;
    revenue: number;
    percentage: number;
  }>;

  @ApiProperty({ description: 'Order status distribution' })
  order_status_distribution: {
    pending: number;
    accepted: number;
    processing: number;
    shipped: number;
    delivered: number;
    cancelled: number;
    disputed: number;
  };

  @ApiProperty({ description: 'Average order processing time (in hours)' })
  avg_processing_time: number;

  @ApiProperty({ description: 'Customer acquisition data' })
  customer_data: {
    new_customers: number;
    returning_customers: number;
    customer_retention_rate: number;
  };

  @ApiProperty({ description: 'Total revenue for the period' })
  total_revenue: number;

  @ApiProperty({ description: 'Currency' })
  currency: string;

  @ApiProperty({ description: 'Period start date' })
  period_start: string;

  @ApiProperty({ description: 'Period end date' })
  period_end: string;
}

export class ProductAnalyticsDto {
  @ApiProperty({ description: 'Product performance metrics' })
  product_performance: Array<{
    product_id: string;
    product_name: string;
    views: number;
    orders: number;
    revenue: number;
    conversion_rate: number;
    stock_level: number;
    status: string;
  }>;

  @ApiProperty({ description: 'Category performance' })
  category_performance: Array<{
    category: string;
    products_count: number;
    total_revenue: number;
    avg_price: number;
    total_orders: number;
  }>;

  @ApiProperty({ description: 'Inventory alerts' })
  inventory_alerts: {
    low_stock: Array<{
      product_id: string;
      product_name: string;
      current_stock: number;
      min_stock_level: number;
    }>;
    out_of_stock: Array<{
      product_id: string;
      product_name: string;
      last_stock_date: string;
    }>;
  };

  @ApiProperty({ description: 'Price analysis' })
  price_analysis: {
    avg_product_price: number;
    price_ranges: Array<{
      range: string;
      products_count: number;
      percentage: number;
    }>;
  };

  @ApiProperty({ description: 'Product lifecycle data' })
  product_lifecycle: {
    new_products: number;
    active_products: number;
    discontinued_products: number;
    draft_products: number;
  };

  @ApiProperty({ description: 'Period start date' })
  period_start: string;

  @ApiProperty({ description: 'Period end date' })
  period_end: string;
}

export class ReportGenerationDto {
  @ApiProperty({ description: 'Report type' })
  @IsEnum(['sales', 'inventory', 'products', 'customers', 'financial'])
  report_type: 'sales' | 'inventory' | 'products' | 'customers' | 'financial';

  @ApiPropertyOptional({ description: 'Report period', enum: AnalyticsPeriod })
  @IsOptional()
  @IsEnum(AnalyticsPeriod)
  period?: AnalyticsPeriod;

  @ApiPropertyOptional({
    description: 'Start date for custom period (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  start_date?: string;

  @ApiPropertyOptional({
    description: 'End date for custom period (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  end_date?: string;

  @ApiPropertyOptional({
    description: 'Report format',
    enum: ['pdf', 'excel', 'csv'],
  })
  @IsOptional()
  @IsEnum(['pdf', 'excel', 'csv'])
  format?: 'pdf' | 'excel' | 'csv';

  @ApiPropertyOptional({ description: 'Include detailed breakdown' })
  @IsOptional()
  include_details?: boolean;
}

export class ReportResponseDto {
  @ApiProperty({ description: 'Report ID' })
  report_id: string;

  @ApiProperty({ description: 'Report type' })
  report_type: string;

  @ApiProperty({ description: 'Report status' })
  status: 'generating' | 'completed' | 'failed';

  @ApiProperty({ description: 'Download URL (when completed)' })
  download_url?: string;

  @ApiProperty({ description: 'Report file name' })
  file_name: string;

  @ApiProperty({ description: 'Report generation started at' })
  created_at: string;

  @ApiProperty({ description: 'Report completed at' })
  completed_at?: string;

  @ApiProperty({ description: 'Error message (if failed)' })
  error_message?: string;

  @ApiProperty({ description: 'Report expires at' })
  expires_at: string;
}
