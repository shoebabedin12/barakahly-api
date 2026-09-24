import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailModule } from '../mail/mail.module.js';
import { Setting } from '../settings/setting.entity.js';
import { PagesController } from './pages.controller.js';
import { PagesService } from './pages.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Setting]), MailModule],
  controllers: [PagesController],
  providers: [PagesService],
})
export class PagesModule {}
