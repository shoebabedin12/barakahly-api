import { AbandonedCartReminderService } from './abandoned-cart-reminder.service.js';

describe('AbandonedCartReminderService', () => {
  const carts = [
    {
      id: 1,
      email: 'a@x.com',
      name: null,
      cartSnapshot: [{ name: 'Fan', quantity: 1, subtotal: 500 }],
      cartTotal: '500.00',
    },
    { id: 2, email: 'b@x.com', name: 'B', cartSnapshot: [], cartTotal: '0.00' },
  ];

  function make(send: () => Promise<void>) {
    const update = vi.fn(async () => {});
    const service = new AbandonedCartReminderService(
      { find: async () => carts, update } as never,
      { findOne: async () => ({ siteName: 'Barakahly' }) } as never,
      { send: vi.fn(send) } as never,
    );
    return { service, update };
  }

  it('sends each due reminder and marks it sent', async () => {
    const { service, update } = make(async () => {});
    expect(await service.run()).toBe(2);
    expect(update).toHaveBeenCalledTimes(2);
  });

  it('leaves carts unmarked when mail fails, so they are retried', async () => {
    const { service, update } = make(async () => {
      throw new Error('No SMTP server is configured.');
    });
    expect(await service.run()).toBe(0);
    expect(update).not.toHaveBeenCalled();
  });
});
