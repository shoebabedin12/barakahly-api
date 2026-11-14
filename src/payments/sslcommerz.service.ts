import { Injectable } from '@nestjs/common';
import type { Customer } from '../customers/customer.entity.js';
import type { Order } from '../orders/order.entity.js';

export type GatewayResult = Record<string, unknown> & {
  status?: string;
  GatewayPageURL?: string;
  tran_id?: string;
  val_id?: string;
  amount?: string;
  currency?: string;
};

/** Port of App\Services\SslcommerzService. Credentials come from the API's .env. */
@Injectable()
export class SslcommerzService {
  private get storeId() {
    return process.env.SSLCOMMERZ_STORE_ID ?? '';
  }
  private get storePassword() {
    return process.env.SSLCOMMERZ_STORE_PASSWORD ?? '';
  }
  private get sandbox() {
    // Same default as Laravel: sandbox unless explicitly turned off.
    return !/^(0|false|no|off)$/i.test(
      process.env.SSLCOMMERZ_SANDBOX ?? 'true',
    );
  }
  private get host() {
    return this.sandbox
      ? 'https://sandbox.sslcommerz.com'
      : 'https://securepay.sslcommerz.com';
  }

  isConfigured() {
    return this.storeId !== '' && this.storePassword !== '';
  }

  /** Public base the gateway posts back to (Nginx sends /api/v1 to this API). */
  callbackBase() {
    const base = (
      process.env.API_PUBLIC_URL ??
      process.env.STOREFRONT_URL ??
      'https://barakahly.com'
    ).replace(/\/+$/, '');
    return `${base}/api/v1/payment/sslcommerz`;
  }

  async initiate(
    order: Order,
    customer: Customer | null,
  ): Promise<GatewayResult> {
    const callbacks = this.callbackBase();
    const city = customer?.city || 'Dhaka';
    const payload = new URLSearchParams({
      store_id: this.storeId,
      store_passwd: this.storePassword,
      total_amount: Number(order.totalAmount).toFixed(2),
      currency: 'BDT',
      tran_id: order.orderNumber,
      success_url: `${callbacks}/success`,
      fail_url: `${callbacks}/fail`,
      cancel_url: `${callbacks}/cancel`,
      ipn_url: `${callbacks}/ipn`,
      shipping_method: 'Courier',
      product_name: `Order ${order.orderNumber}`,
      product_category: 'General',
      product_profile: 'general',
      cus_name: customer?.name || 'Customer',
      cus_email: customer?.email || 'customer@example.com',
      cus_add1: order.shippingAddress || 'N/A',
      cus_city: city,
      cus_country: 'Bangladesh',
      cus_phone: customer?.phone || 'N/A',
      ship_name: customer?.name || 'Customer',
      ship_add1: order.shippingAddress || 'N/A',
      ship_city: city,
      ship_country: 'Bangladesh',
      value_a: String(order.id),
    });
    const res = await fetch(`${this.host}/gwprocess/v4/api.php`, {
      method: 'POST',
      body: payload,
      signal: AbortSignal.timeout(20_000),
    });
    return ((await res.json().catch(() => ({}))) ?? {}) as GatewayResult;
  }

  async validate(valId: string): Promise<GatewayResult> {
    const query = new URLSearchParams({
      val_id: valId,
      store_id: this.storeId,
      store_passwd: this.storePassword,
      format: 'json',
    });
    const res = await fetch(
      `${this.host}/validator/api/validationserverAPI.php?${query}`,
      { signal: AbortSignal.timeout(20_000) },
    );
    return ((await res.json().catch(() => ({}))) ?? {}) as GatewayResult;
  }
}
