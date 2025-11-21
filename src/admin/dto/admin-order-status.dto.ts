import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsUUID } from 'class-validator';
import { OrderStatus } from '../../sellers/dto/order.dto';

export class UpdateAdminOrderStatusDto {
  @ApiProperty({ description: 'New order status', enum: OrderStatus })
  @IsEnum(OrderStatus)
  status: OrderStatus;
}

export class AssignDriverDto {
  @ApiProperty({ description: 'Driver user id (individual driver account)' })
  @IsUUID()
  driverId: string;
}
