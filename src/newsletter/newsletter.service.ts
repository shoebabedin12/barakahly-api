import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NewsletterSubscriber } from './newsletter-subscriber.entity.js';

@Injectable()
export class NewsletterService {
  constructor(
    @InjectRepository(NewsletterSubscriber)
    private readonly subscribers: Repository<NewsletterSubscriber>,
  ) {}

  /** Mirrors Api\V1\NewsletterController@store exactly, including the
   * "already subscribed" short-circuit and the updateOrCreate semantics. */
  async subscribe(email: string) {
    const existing = await this.subscribers.findOne({ where: { email } });

    if (existing?.status) {
      return { message: 'You are already subscribed to our newsletter.' };
    }

    if (existing) {
      await this.subscribers.update(existing.id, {
        status: true,
        source: 'Website',
        subscribedAt: new Date(),
      });
    } else {
      await this.subscribers.insert(
        this.subscribers.create({
          email,
          status: true,
          source: 'Website',
          subscribedAt: new Date(),
        }),
      );
    }

    return { message: 'Thanks for subscribing! Watch your inbox for our latest offers.' };
  }
}
