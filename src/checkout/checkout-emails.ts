import type { Customer } from '../customers/customer.entity.js';
import type { OrderItem } from '../orders/order-item.entity.js';
import type { Order } from '../orders/order.entity.js';

const escape = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const money = (value: string | number) =>
  `৳${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ucfirst = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

/** The shared card layout used by every Barakahly email (brand green header on cream). */
function layout(heading: string, body: string, width = 560) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#F8F4E9; font-family: Arial, Helvetica, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F8F4E9; padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="${width}" cellpadding="0" cellspacing="0" style="max-width:${width}px; width:100%; background-color:#ffffff; border-radius:12px; overflow:hidden;">
          <tr>
            <td style="background-color:#0B3D2E; padding:24px 32px;">
              <span style="color:#ffffff; font-size:20px; font-weight:bold;">${escape(heading)}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px; color:#1B1B1B; font-size:15px; line-height:1.7;">
${body}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function itemsTable(items: OrderItem[]) {
  const rows = items
    .map(
      (item) => `<tr>
        <td style="padding:8px 0; border-bottom:1px solid #eee;">${escape(item.productName)}${
          item.variantColor || item.variantSize
            ? `<br><span style="color:#6b7280; font-size:13px;">${escape(
                [item.variantColor, item.variantSize]
                  .filter(Boolean)
                  .join(' / '),
              )}</span>`
            : ''
        }</td>
        <td style="padding:8px 0; border-bottom:1px solid #eee; text-align:center;">${item.quantity}</td>
        <td style="padding:8px 0; border-bottom:1px solid #eee; text-align:right;">${money(item.subtotal)}</td>
      </tr>`,
    )
    .join('');

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0; font-size:14px;">
      <tr>
        <th align="left" style="padding:8px 0; border-bottom:2px solid #0B3D2E;">Product</th>
        <th style="padding:8px 0; border-bottom:2px solid #0B3D2E;">Qty</th>
        <th align="right" style="padding:8px 0; border-bottom:2px solid #0B3D2E;">Subtotal</th>
      </tr>
      ${rows}
    </table>`;
}

function button(url: string, label: string) {
  return `<p style="margin:24px 0 0; text-align:center;">
      <a href="${escape(url)}" style="display:inline-block; background-color:#0B3D2E; color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:8px; font-weight:bold;">${escape(label)}</a>
    </p>`;
}

/** emails.checkout-otp */
export function checkoutOtpEmail(siteName: string, code: string) {
  return layout(
    siteName,
    `              <div style="text-align:center;">
                <p style="margin:0 0 8px;">Your order verification code is:</p>
                <p style="margin:16px 0; font-size:36px; font-weight:bold; letter-spacing:8px; color:#0B3D2E;">${escape(code)}</p>
                <p style="margin:16px 0 0; color:#6b7280; font-size:13px;">This code expires in 10 minutes. If you did not request this, you can ignore this email.</p>
              </div>`,
    480,
  );
}

/** emails.order-placed - sent to the customer. */
export function orderPlacedEmail(
  siteName: string,
  order: Order,
  items: OrderItem[],
  customer: Customer | null,
  orderUrl: string,
) {
  return layout(
    siteName,
    `              <h1 style="margin:0 0 16px; font-size:20px;">Thank you for your order!</h1>
              <p style="margin:0 0 8px;">Hi ${escape(customer?.name ?? 'Customer')},</p>
              <p style="margin:0;">Your order <strong>${escape(order.orderNumber)}</strong> has been placed successfully.</p>
              ${itemsTable(items)}
              <p style="margin:0;"><strong>Subtotal:</strong> ${money(order.subtotal)}<br>
              <strong>Shipping:</strong> ${money(order.shippingCharge)}<br>
              <strong>Discount:</strong> - ${money(order.discountAmount)}<br>
              <strong>Total:</strong> ${money(order.totalAmount)}</p>
              <p style="margin:16px 0 0;"><strong>Payment Method:</strong> ${escape(order.paymentMethod ?? '')}<br>
              <strong>Payment Status:</strong> ${escape(ucfirst(order.paymentStatus))}</p>
              ${button(orderUrl, 'View Order')}
              <p style="margin:24px 0 0;">Thanks for shopping with us,<br>${escape(siteName)}</p>`,
  );
}

/** emails.new-order-notification - sent to the store's contact email. */
export function newOrderAdminEmail(
  siteName: string,
  order: Order,
  items: OrderItem[],
  customer: Customer | null,
  adminUrl: string,
) {
  return layout(
    'New Order Received',
    `              <p style="margin:0 0 16px;">A new order has been placed on your store.</p>
              <p style="margin:0;"><strong>Order Number:</strong> ${escape(order.orderNumber)}<br>
              <strong>Customer:</strong> ${escape(customer?.name ?? 'N/A')} (${escape(customer?.phone ?? 'N/A')})<br>
              <strong>Total Amount:</strong> ${money(order.totalAmount)}<br>
              <strong>Payment Method:</strong> ${escape(order.paymentMethod ?? '')}<br>
              <strong>Payment Status:</strong> ${escape(ucfirst(order.paymentStatus))}</p>
              ${itemsTable(items)}
              ${button(adminUrl, 'View Order in Admin Panel')}
              <p style="margin:24px 0 0;">${escape(siteName)}</p>`,
  );
}
