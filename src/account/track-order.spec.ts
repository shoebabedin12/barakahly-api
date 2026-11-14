import { NotFoundException } from '@nestjs/common';
import { AccountService } from './account.service.js';

function makeService(order: unknown) {
  const repo = (overrides: Record<string, unknown>) => overrides as never;
  return new AccountService(
    repo({ findOne: async () => order }),
    repo({ find: async () => [] }),
    repo({
      find: async () => [
        {
          status: 'processing',
          note: 'internal note',
          createdAt: new Date('2026-11-02T10:00:00Z'),
        },
      ],
    }),
    repo({}),
    repo({}),
    repo({}),
    { imagesFor: async () => new Map() } as never,
  );
}

const order = {
  id: 7,
  orderNumber: 'ORD-1755000000',
  subtotal: '500.00',
  shippingCharge: '80.00',
  discountAmount: '0.00',
  totalAmount: '580.00',
  paymentMethod: 'Cash on Delivery',
  paymentStatus: 'pending',
  orderStatus: 'processing',
  shippingAddress: 'House 1, Mirpur',
  createdAt: new Date('2026-11-01T10:00:00Z'),
  customer: { phone: '01686586914' },
};

describe('AccountService.trackOrder', () => {
  it('matches the phone regardless of +880 / 880 / 0 prefix', async () => {
    for (const phone of ['01686586914', '+8801686586914', '880 1686-586914']) {
      const res = await makeService(order).trackOrder('ord-1755000000', phone);
      expect(res.data.order_number).toBe('ORD-1755000000');
    }
  });

  it('omits the address and admin notes', async () => {
    const res = await makeService(order).trackOrder(
      'ORD-1755000000',
      '01686586914',
    );
    expect(res.data).not.toHaveProperty('shipping_address');
    expect(res.data.status_history).toEqual([
      { status: 'processing', created_at: expect.any(String) },
    ]);
  });

  it('404s on a wrong phone, a too-short phone, or a missing order', async () => {
    await expect(
      makeService(order).trackOrder('ORD-1755000000', '01700000000'),
    ).rejects.toThrow(NotFoundException);
    await expect(
      makeService(order).trackOrder('ORD-1755000000', '586914'),
    ).rejects.toThrow(NotFoundException);
    await expect(
      makeService(null).trackOrder('ORD-1', '01686586914'),
    ).rejects.toThrow(NotFoundException);
  });
});
