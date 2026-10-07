import { assetUrl } from '../common/asset-url.js';
import { iso8601 } from '../common/iso-date.js';
import type { OrderItem } from '../orders/order-item.entity.js';
import type { Order } from '../orders/order.entity.js';
import type { ProductImage } from '../products/product-image.entity.js';

/** OrderResource; `items` only when they were loaded (whenLoaded). */
export function presentOrder(
  order: Order,
  items?: OrderItem[],
  imagesByProduct?: Map<number, ProductImage[]>,
) {
  return {
    id: order.id,
    order_number: order.orderNumber,
    subtotal: Number(order.subtotal),
    shipping_charge: Number(order.shippingCharge),
    discount_amount: Number(order.discountAmount),
    total_amount: Number(order.totalAmount),
    payment_method: order.paymentMethod,
    payment_status: order.paymentStatus,
    order_status: order.orderStatus,
    shipping_address: order.shippingAddress,
    created_at: iso8601(order.createdAt),
    ...(items
      ? {
          items: items.map((item) => {
            const image = item.productId
              ? imagesByProduct?.get(item.productId)?.[0]
              : undefined;
            return {
              id: item.id,
              product_id: item.productId,
              product_name: item.productName,
              variant_color: item.variantColor,
              variant_size: item.variantSize,
              price: Number(item.price),
              quantity: item.quantity,
              subtotal: Number(item.subtotal),
              image: image ? assetUrl(image.image) : null,
            };
          }),
        }
      : {}),
  };
}
