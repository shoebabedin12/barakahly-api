import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MailService } from '../mail/mail.service.js';
import { Setting } from '../settings/setting.entity.js';
import { ContactDto } from './dto/contact.dto.js';

@Injectable()
export class PagesService {
  constructor(
    @InjectRepository(Setting)
    private readonly settings: Repository<Setting>,
    private readonly mail: MailService,
  ) {}

  /** Mirrors Api\V1\PageController@sendContact, including the
   * emails.contact-message Blade template's markup. */
  async sendContact(dto: ContactDto) {
    const setting = await this.settings.findOne({ where: {}, order: { id: 'ASC' } });
    const recipient = setting?.contactEmail;

    if (recipient) {
      await this.mail.send({
        to: recipient,
        subject: `New Contact Message from ${dto.name}`,
        replyTo: dto.email,
        html: this.renderContactEmail(dto),
      });
    }

    return { message: 'Thanks for reaching out! We will get back to you soon.' };
  }

  private renderContactEmail(dto: ContactDto): string {
    const escape = (value: string) =>
      value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const phoneRow = dto.phone
      ? `<p style="margin:0 0 6px;"><strong>Phone:</strong> ${escape(dto.phone)}</p>`
      : '';

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
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px; width:100%; background-color:#ffffff; border-radius:12px; overflow:hidden;">
          <tr>
            <td style="background-color:#0B3D2E; padding:24px 32px;">
              <span style="color:#ffffff; font-size:20px; font-weight:bold;">New Contact Message</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px; color:#1B1B1B; font-size:15px; line-height:1.7;">
              <p style="margin:0 0 6px;"><strong>Name:</strong> ${escape(dto.name)}</p>
              <p style="margin:0 0 6px;"><strong>Email:</strong> ${escape(dto.email)}</p>
              ${phoneRow}
              <p style="margin:20px 0 6px; font-weight:bold;">Message:</p>
              <p style="margin:0; white-space:pre-line;">${escape(dto.message)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }
}
