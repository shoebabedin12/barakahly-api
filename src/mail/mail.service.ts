import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import nodemailer from 'nodemailer';
import { Repository } from 'typeorm';
import { Setting } from '../settings/setting.entity.js';

interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

/**
 * Mirrors AppServiceProvider::applyDynamicMailConfig() in the Laravel app:
 * SMTP settings stored on the `settings` row override the env defaults
 * (MAIL_HOST/PORT/USERNAME/PASSWORD/FROM_*), falling back to env when the
 * DB row hasn't been configured yet.
 */
@Injectable()
export class MailService {
  constructor(
    @InjectRepository(Setting)
    private readonly settings: Repository<Setting>,
  ) {}

  async send({ to, subject, html, replyTo }: SendMailInput): Promise<void> {
    const setting = await this.settings.findOne({ where: {}, order: { id: 'ASC' } });

    const host = setting?.mailHost || process.env.MAIL_HOST;
    if (!host) return; // no mail configured anywhere - silently no-op, same as Laravel would fail on send

    const port = Number(setting?.mailPort || process.env.MAIL_PORT || 587);
    const encryption = (setting?.mailEncryption || process.env.MAIL_SCHEME || '').toLowerCase();
    const secure = encryption.includes('ssl') || encryption.includes('smtps') || port === 465;

    const username = setting?.mailUsername || process.env.MAIL_USERNAME;
    const password = setting?.mailPassword || process.env.MAIL_PASSWORD;

    const fromAddress = setting?.mailFromAddress || process.env.MAIL_FROM_ADDRESS || username;
    const fromName = setting?.mailFromName || process.env.MAIL_FROM_NAME || setting?.siteName;

    const transport = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: username ? { user: username, pass: password ?? undefined } : undefined,
    });

    await transport.sendMail({
      from: fromName ? `"${fromName}" <${fromAddress}>` : fromAddress,
      to,
      subject,
      html,
      replyTo,
    });
  }
}
