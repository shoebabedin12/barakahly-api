import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Signed "pay this order" link for orders created from the admin panel: the
 * customer opens it without logging in, and the signature stops anyone from
 * walking order numbers to reach other people's checkout pages.
 */
function signature(orderNumber: string) {
  const secret = process.env.ADMIN_JWT_SECRET ?? '';
  return createHmac('sha256', `pay-link:${secret}`)
    .update(orderNumber)
    .digest('hex')
    .slice(0, 32);
}

export function payLinkUrl(orderNumber: string) {
  const base = (
    process.env.API_PUBLIC_URL ??
    process.env.STOREFRONT_URL ??
    'https://barakahly.com'
  ).replace(/\/+$/, '');
  return `${base}/api/v1/payment/sslcommerz/pay/${encodeURIComponent(orderNumber)}?sig=${signature(orderNumber)}`;
}

export function verifyPayLink(orderNumber: string, sig: string | undefined) {
  if (!sig || !process.env.ADMIN_JWT_SECRET) return false;
  const expected = Buffer.from(signature(orderNumber));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
