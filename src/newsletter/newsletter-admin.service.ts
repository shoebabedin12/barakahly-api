import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MailService } from '../mail/mail.service.js';
import { Setting } from '../settings/setting.entity.js';
import { adminPage, orNotFound } from '../store-admin/admin-page.js';
import type { NewsletterMessageDto } from './dto/newsletter-admin.dto.js';
import { NewsletterLog } from './newsletter-log.entity.js';
import { NewsletterSubscriber } from './newsletter-subscriber.entity.js';

const escape = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Same markup as resources/views/emails/newsletter.blade.php. */
function newsletterHtml(siteName: string, bodyHtml: string) {
  const name = escape(siteName);
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
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background-color:#ffffff; border-radius:12px; overflow:hidden;">
          <tr>
            <td style="background-color:#0B3D2E; padding:24px 32px;">
              <span style="color:#ffffff; font-size:20px; font-weight:bold;">${name}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px; color:#1B1B1B; font-size:15px; line-height:1.7;">
${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px; background-color:#F8F4E9; color:#6b7280; font-size:12px;">
              You are receiving this email because you subscribed to updates from ${name}.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

const csvCell = (value: string | null | undefined) => {
  const v = value ?? '';
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
};

/** "13 Oct 2026, 11:20 PM" like the Laravel export, in Dhaka time. */
const exportDate = (d: Date | null) =>
  d
    ? d.toLocaleString('en-GB', {
        timeZone: 'Asia/Dhaka',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
    : '';

@Injectable()
export class NewsletterAdminService {
  private readonly logger = new Logger(NewsletterAdminService.name);

  constructor(
    @InjectRepository(NewsletterSubscriber)
    private readonly subscribers: Repository<NewsletterSubscriber>,
    @InjectRepository(NewsletterLog)
    private readonly logs: Repository<NewsletterLog>,
    @InjectRepository(Setting)
    private readonly settings: Repository<Setting>,
    private readonly mail: MailService,
  ) {}

  async findAll(page: number) {
    const perPage = 20;
    const [rows, total] = await this.subscribers.findAndCount({
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (page - 1) * perPage,
      take: perPage,
    });
    const [locationBreakdown, activeCount] = await Promise.all([
      this.subscribers
        .createQueryBuilder('s')
        .select("COALESCE(NULLIF(s.location, ''), 'Unknown')", 'location')
        .addSelect('COUNT(*)', 'total')
        .groupBy('location')
        .orderBy('total', 'DESC')
        .getRawMany<{ location: string; total: string }>()
        .then((rows) => rows.map((r) => ({ location: r.location, total: Number(r.total) }))),
      this.subscribers.count({ where: { status: true } }),
    ]);
    return { ...adminPage(rows, total, page, perPage), locationBreakdown, activeCount };
  }

  async findOne(id: number) {
    return orNotFound(await this.subscribers.findOneBy({ id }), 'Subscriber');
  }

  async remove(id: number) {
    await this.subscribers.delete((await this.findOne(id)).id);
  }

  async exportCsv() {
    const rows = await this.subscribers.find({ order: { createdAt: 'DESC', id: 'DESC' } });
    const lines = [
      ['Email', 'Location', 'Device', 'Browser', 'OS', 'Source', 'Status', 'Subscribed At'].join(','),
      ...rows.map((s) =>
        [
          s.email,
          s.location ?? 'Unknown',
          s.device,
          s.browser,
          s.operatingSystem,
          s.source,
          s.status ? 'Active' : 'Unsubscribed',
          exportDate(s.subscribedAt ?? s.createdAt),
        ]
          .map(csvCell)
          .join(','),
      ),
    ];
    // BOM so Excel opens the UTF-8 file correctly.
    return '﻿' + lines.join('\r\n');
  }

  /**
   * Emails every active subscriber. Returns straight away with the batch id;
   * the sends run in the background (Laravel queued them) and each one is
   * logged as sent/failed, which the batch page shows as it fills in.
   */
  async broadcast(dto: NewsletterMessageDto) {
    const recipients = await this.subscribers.find({
      where: { status: true },
      select: { id: true, email: true },
      order: { id: 'ASC' },
    });
    const batchId = randomUUID();
    const html = newsletterHtml(await this.siteName(), dto.body);

    void (async () => {
      for (const r of recipients) {
        const error = await this.deliver(r.email, dto.subject, html, 3);
        await this.log(r.id, r.email, dto.subject, 'broadcast', batchId, error).catch((err: unknown) =>
          this.logger.error(`Could not log newsletter send to ${r.email}: ${String(err)}`),
        );
      }
    })();

    return { batchId, count: recipients.length };
  }

  /** Emails one subscriber now and reports whether it went. */
  async sendOne(id: number, dto: NewsletterMessageDto) {
    const subscriber = await this.findOne(id);
    const html = newsletterHtml(await this.siteName(), dto.body);
    const error = await this.deliver(subscriber.email, dto.subject, html, 1);
    await this.log(subscriber.id, subscriber.email, dto.subject, 'individual', null, error);
    return error
      ? { sent: false, message: `Failed to send email: ${error}` }
      : { sent: true, message: `Email sent to ${subscriber.email}.` };
  }

  async logsIndex(batchesPage: number, individualPage: number) {
    const perPage = 15;
    const batchQuery = this.logs
      .createQueryBuilder('l')
      .select('l.batch_id', 'batchId')
      .addSelect('l.subject', 'subject')
      .addSelect('MIN(l.created_at)', 'sentAt')
      .addSelect("SUM(l.status = 'sent')", 'sentCount')
      .addSelect("SUM(l.status = 'failed')", 'failedCount')
      .where('l.batch_id IS NOT NULL')
      .groupBy('l.batch_id')
      .addGroupBy('l.subject');
    const [batchRows, batchTotal, [individual, individualTotal]] = await Promise.all([
      batchQuery
        .clone()
        .orderBy('sentAt', 'DESC')
        .offset((batchesPage - 1) * perPage)
        .limit(perPage)
        .getRawMany<{ batchId: string; subject: string; sentAt: Date; sentCount: string; failedCount: string }>(),
      this.logs
        .createQueryBuilder('l')
        .select('COUNT(DISTINCT l.batch_id)', 'n')
        .where('l.batch_id IS NOT NULL')
        .getRawOne<{ n: string }>()
        .then((r) => Number(r?.n ?? 0)),
      this.logs.findAndCount({
        where: { type: 'individual' },
        order: { createdAt: 'DESC', id: 'DESC' },
        skip: (individualPage - 1) * perPage,
        take: perPage,
      }),
    ]);
    return {
      batches: adminPage(
        batchRows.map((b) => ({ ...b, sentCount: Number(b.sentCount), failedCount: Number(b.failedCount) })),
        batchTotal,
        batchesPage,
        perPage,
      ),
      individual: adminPage(individual, individualTotal, individualPage, perPage),
    };
  }

  async batch(batchId: string, page: number) {
    const perPage = 50;
    const [[logs, total], counts] = await Promise.all([
      this.logs.findAndCount({
        where: { batchId },
        order: { email: 'ASC' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.logs
        .createQueryBuilder('l')
        .select('MIN(l.subject)', 'subject')
        .addSelect("SUM(l.status = 'sent')", 'sentCount')
        .addSelect("SUM(l.status = 'failed')", 'failedCount')
        .where('l.batch_id = :batchId', { batchId })
        .getRawOne<{ subject: string | null; sentCount: string | null; failedCount: string | null }>(),
    ]);
    return {
      ...adminPage(logs, total, page, perPage),
      batchId,
      subject: counts?.subject ?? null,
      sentCount: Number(counts?.sentCount ?? 0),
      failedCount: Number(counts?.failedCount ?? 0),
    };
  }

  // ------------------------------------------------------------- internals

  private async siteName() {
    const setting = await this.settings.findOne({ where: {}, order: { id: 'ASC' } });
    return setting?.siteName || process.env.APP_NAME || 'Barakahly';
  }

  /** Sends with up to `attempts` tries; returns the last error message, or null on success. */
  private async deliver(to: string, subject: string, html: string, attempts: number) {
    let error: string | null = null;
    for (let i = 0; i < attempts; i++) {
      try {
        await this.mail.send({ to, subject, html, required: true });
        return null;
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
      }
    }
    return error;
  }

  private log(
    subscriberId: number,
    email: string,
    subject: string,
    type: 'broadcast' | 'individual',
    batchId: string | null,
    error: string | null,
  ) {
    return this.logs.save(
      this.logs.create({
        subscriberId,
        email,
        subject,
        type,
        batchId,
        status: error ? 'failed' : 'sent',
        error,
      }),
    );
  }
}
