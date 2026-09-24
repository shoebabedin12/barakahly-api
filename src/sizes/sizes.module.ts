import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAuthModule } from '../admin-auth/admin-auth.module.js';
import { Size } from './size.entity.js';
import { SizesController } from './sizes.controller.js';
import { SizesService } from './sizes.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Size]), AdminAuthModule],
  controllers: [SizesController],
  providers: [SizesService],
  exports: [TypeOrmModule],
})
export class SizesModule {}
