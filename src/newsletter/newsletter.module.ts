import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAuthModule } from '../admin-auth/admin-auth.module.js';
import { MailModule } from '../mail/mail.module.js';
import { Setting } from '../settings/setting.entity.js';
import { NewsletterAdminController } from './newsletter-admin.controller.js';
import { NewsletterAdminService } from './newsletter-admin.service.js';
import { NewsletterLog } from './newsletter-log.entity.js';
import { NewsletterSubscriber } from './newsletter-subscriber.entity.js';
import { NewsletterController } from './newsletter.controller.js';
import { NewsletterService } from './newsletter.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([NewsletterSubscriber, NewsletterLog, Setting]),
    AdminAuthModule,
    MailModule,
  ],
  controllers: [NewsletterController, NewsletterAdminController],
  providers: [NewsletterService, NewsletterAdminService],
})
export class NewsletterModule {}
