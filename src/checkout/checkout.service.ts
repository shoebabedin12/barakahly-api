import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentMethod } from '../payment-methods/payment-method.entity.js';
import { ShippingZone } from '../shipping-zones/shipping-zone.entity.js';

@Injectable()
export class CheckoutService {
  constructor(
    @InjectRepository(PaymentMethod)
    private readonly paymentMethods: Repository<PaymentMethod>,
    @InjectRepository(ShippingZone)
    private readonly shippingZones: Repository<ShippingZone>,
  ) {}

  async getOptions() {
    const [methods, zones] = await Promise.all([
      this.paymentMethods.find({
        where: { status: true },
        order: { sortOrder: 'ASC' },
      }),
      this.shippingZones.find({ where: { status: true } }),
    ]);

    return {
      payment_methods: methods.map((method) => ({
        id: method.id,
        name: method.name,
        code: method.code,
        instructions: method.instructions,
        requires_transaction_id: method.requiresTransactionId,
      })),
      shipping_zones: zones.map((zone) => ({
        id: zone.id,
        name: zone.name,
        charge: zone.charge,
      })),
    };
  }
}
