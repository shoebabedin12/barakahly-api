import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Setting } from '../settings/setting.entity.js';
import { MailService } from './mail.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Setting])],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
