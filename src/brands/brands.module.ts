import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAuthModule } from '../admin-auth/admin-auth.module.js';
import { Brand } from './brand.entity.js';
import { BrandsController } from './brands.controller.js';
import { BrandsService } from './brands.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Brand]), AdminAuthModule],
  controllers: [BrandsController],
  providers: [BrandsService],
})
export class BrandsModule {}
