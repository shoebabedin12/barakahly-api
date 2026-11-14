import { payLinkUrl, verifyPayLink } from './pay-link.js';
import { PaymentsService } from './payments.service.js';

describe('pay links', () => {
  beforeAll(() => {
    process.env.ADMIN_JWT_SECRET = 'test-secret';
  });

  it('verifies its own signature and rejects others', () => {
    const sig = new URL(payLinkUrl('ORD-1')).searchParams.get('sig')!;
    expect(verifyPayLink('ORD-1', sig)).toBe(true);
    expect(verifyPayLink('ORD-2', sig)).toBe(false);
    expect(verifyPayLink('ORD-1', undefined)).toBe(false);
    expect(verifyPayLink('ORD-1', 'short')).toBe(false);
  });
});

describe('PaymentsService.confirm', () => {
  const order = {
    id: 1,
    orderNumber: 'ORD-1',
    totalAmount: '580.00',
    paymentStatus: 'pending',
    customer: null,
  };

  function make(result: Record<string, unknown>) {
    const execute = vi.fn(async () => ({ affected: 1 }));
    const qb = {
      update: () => qb,
      set: () => qb,
      where: () => qb,
      andWhere: () => qb,
      setParameter: () => qb,
      execute,
    };
    const repo = {
      findOne: async () => ({ ...order }),
      createQueryBuilder: () => qb,
    };
    const notify = vi.fn(async () => {});
    const service = new PaymentsService(
      { getRepository: () => repo } as never,
      { validate: async () => result } as never,
      { sendOrderPlacedNotifications: notify } as never,
    );
    return { service, execute, notify };
  }

  it('marks the order paid when the validated payment matches', async () => {
    const { service, execute, notify } = make({
      status: 'VALID',
      tran_id: 'ORD-1',
      amount: '580.00',
      currency: 'BDT',
    });
    expect(await service.confirm('ORD-1', 'val')).not.toBeNull();
    expect(execute).toHaveBeenCalled();
    expect(notify).toHaveBeenCalled();
  });

  it.each([
    [
      'an underpayment',
      { status: 'VALID', tran_id: 'ORD-1', amount: '100.00', currency: 'BDT' },
    ],
    [
      'another order',
      { status: 'VALID', tran_id: 'ORD-9', amount: '580.00', currency: 'BDT' },
    ],
    [
      'a failed status',
      { status: 'FAILED', tran_id: 'ORD-1', amount: '580.00' },
    ],
    [
      'another currency',
      { status: 'VALID', tran_id: 'ORD-1', amount: '580.00', currency: 'USD' },
    ],
  ])('refuses %s', async (_, result) => {
    const { service, execute } = make(result);
    expect(await service.confirm('ORD-1', 'val')).toBeNull();
    expect(execute).not.toHaveBeenCalled();
  });
});
