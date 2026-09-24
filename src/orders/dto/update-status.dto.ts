import { IsArray, IsIn, IsInt } from 'class-validator';

const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'] as const;
const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'] as const;

export class UpdateOrderStatusDto {
  @IsIn(ORDER_STATUSES)
  orderStatus: (typeof ORDER_STATUSES)[number];
}

export class BulkUpdateOrderStatusDto {
  @IsArray()
  @IsInt({ each: true })
  ids: number[];

  @IsIn(ORDER_STATUSES)
  orderStatus: (typeof ORDER_STATUSES)[number];
}

export class UpdatePaymentStatusDto {
  @IsIn(PAYMENT_STATUSES)
  paymentStatus: (typeof PAYMENT_STATUSES)[number];
}

export class MergeOrderDto {
  @IsInt()
  mergeOrderId: number;
}
