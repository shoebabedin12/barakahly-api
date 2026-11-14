import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Repository } from 'typeorm';
import webpush from 'web-push';
import { PushSubscription } from './push-subscription.entity.js';

interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

const hashEndpoint = (endpoint: string) =>
  createHash('sha256').update(endpoint).digest('hex');

/**
 * Port of App\Services\WebPushService: browser notifications to every admin
 * who turned them on. VAPID keys come from VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY;
 * when those aren't set, a key pair is generated once and kept in
 * `.vapid-keys.json` next to the API's .env (deploys never touch that file),
 * because changing keys would silently break every saved subscription.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private keys: VapidKeys | null = null;

  constructor(
    @InjectRepository(PushSubscription)
    private readonly subscriptions: Repository<PushSubscription>,
  ) {}

  private vapid(): VapidKeys {
    if (this.keys) return this.keys;
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      this.keys = {
        publicKey: process.env.VAPID_PUBLIC_KEY,
        privateKey: process.env.VAPID_PRIVATE_KEY,
      };
      return this.keys;
    }
    const file = join(process.cwd(), '.vapid-keys.json');
    try {
      this.keys = JSON.parse(readFileSync(file, 'utf8')) as VapidKeys;
    } catch {
      this.keys = webpush.generateVAPIDKeys();
      try {
        writeFileSync(file, JSON.stringify(this.keys), { mode: 0o600 });
      } catch (error) {
        this.logger.warn(
          `Could not save VAPID keys: ${(error as Error).message}`,
        );
      }
    }
    return this.keys;
  }

  publicKey() {
    return { publicKey: this.vapid().publicKey };
  }

  async subscribe(
    userId: number,
    input: { endpoint: string; keys: { p256dh: string; auth: string } },
  ) {
    const endpointHash = hashEndpoint(input.endpoint);
    const existing = await this.subscriptions.findOneBy({ endpointHash });
    await this.subscriptions.save(
      Object.assign(
        existing ?? this.subscriptions.create({ createdAt: new Date() }),
        {
          userId,
          endpoint: input.endpoint,
          endpointHash,
          publicKey: input.keys.p256dh,
          authToken: input.keys.auth,
          updatedAt: new Date(),
        },
      ),
    );
    return { message: 'Subscribed.' };
  }

  async unsubscribe(endpoint: string) {
    await this.subscriptions.delete({ endpointHash: hashEndpoint(endpoint) });
    return { message: 'Unsubscribed.' };
  }

  /** Never throws: a failed notification must not affect the order that triggered it. */
  async sendToAll(title: string, body: string, url?: string) {
    try {
      const all = await this.subscriptions.find();
      if (!all.length) return;
      const keys = this.vapid();
      const subject =
        process.env.VAPID_SUBJECT ??
        (process.env.STOREFRONT_URL ?? 'https://barakahly.com').replace(
          /\/+$/,
          '',
        );
      const payload = JSON.stringify({ title, body, url });

      await Promise.all(
        all.map(async (sub) => {
          try {
            await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.publicKey, auth: sub.authToken },
              },
              payload,
              { vapidDetails: { subject, ...keys }, TTL: 60 * 60 },
            );
          } catch (error) {
            const status = (error as { statusCode?: number }).statusCode;
            // 404/410: the browser dropped this subscription, so forget it.
            if (status === 404 || status === 410) {
              await this.subscriptions.delete({ id: sub.id });
            } else {
              this.logger.warn(`Web push failed: ${(error as Error).message}`);
            }
          }
        }),
      );
    } catch (error) {
      this.logger.warn(`Web push send failed: ${(error as Error).message}`);
    }
  }
}
