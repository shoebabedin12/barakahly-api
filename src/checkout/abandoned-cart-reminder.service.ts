import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, IsNull, Repository } from 'typeorm';
import { MailService } from '../mail/mail.service.js';
import { Setting } from '../settings/setting.entity.js';
import { AbandonedCart } from './abandoned-cart.entity.js';
import { abandonedCartEmail } from './checkout-emails.js';

const HOUR = 60 * 60 * 1000;

/**
 * Replaces Laravel's `app:send-abandoned-cart-reminders`: guests who verified
 * their email at checkout but never ordered get one reminder, sent between 1
 * hour and 3 days after they verified. Runs inside the API process every 15
 * minutes (pm2 runs a single instance, so there is no double-sending).
 */
@Injectable()
export class AbandonedCartReminderService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(AbandonedCartReminderService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    @InjectRepository(AbandonedCart)
    private readonly carts: Repository<AbandonedCart>,
    @InjectRepository(Setting)
    private readonly settings: Repository<Setting>,
    private readonly mail: MailService,
  ) {}

  onApplicationBootstrap() {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.run(), 15 * 60 * 1000);
    this.timer.unref();
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Sends due reminders; returns how many went out. */
  async run(now = new Date()): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    let sent = 0;
    try {
      const due = await this.carts.find({
        where: {
          recoveredAt: IsNull(),
          reminderSentAt: IsNull(),
          createdAt: Between(
            new Date(now.getTime() - 72 * HOUR),
            new Date(now.getTime() - HOUR),
          ),
        },
        order: { id: 'ASC' },
        take: 50,
      });
      if (!due.length) return 0;

      const setting = await this.settings.findOne({
        where: {},
        order: { id: 'ASC' },
      });
      const siteName = setting?.siteName || 'Barakahly';
      const storefront = (
        process.env.STOREFRONT_URL ??
        process.env.APP_URL ??
        'https://barakahly.com'
      ).replace(/\/+$/, '');

      for (const cart of due) {
        try {
          await this.mail.send({
            to: cart.email,
            subject: 'You left something in your cart',
            html: abandonedCartEmail(
              siteName,
              cart.name,
              cart.cartSnapshot ?? [],
              cart.cartTotal,
              `${storefront}/cart`,
            ),
            // Throw when SMTP is missing, so the cart stays unsent and is
            // retried once mail works, instead of being marked as reminded.
            required: true,
          });
        } catch (error) {
          this.logger.warn(
            `Abandoned cart reminder failed, will retry: ${(error as Error).message}`,
          );
          break;
        }
        await this.carts.update(cart.id, {
          reminderSentAt: new Date(),
          updatedAt: new Date(),
        });
        sent++;
      }
      if (sent) this.logger.log(`Sent ${sent} abandoned cart reminder(s).`);
      return sent;
    } finally {
      this.running = false;
    }
  }
}
