import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAuthModule } from '../admin-auth/admin-auth.module.js';
import { Color } from './color.entity.js';
import { ColorsController } from './colors.controller.js';
import { ColorsService } from './colors.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Color]), AdminAuthModule],
  controllers: [ColorsController],
  providers: [ColorsService],
  exports: [TypeOrmModule],
})
export class ColorsModule {}
