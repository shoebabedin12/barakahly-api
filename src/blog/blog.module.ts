import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAuthModule } from '../admin-auth/admin-auth.module.js';
import { BlogPost } from './blog-post.entity.js';
import { BlogAdminController, BlogController } from './blog.controllers.js';
import { BlogService } from './blog.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([BlogPost]), AdminAuthModule],
  controllers: [BlogAdminController, BlogController],
  providers: [BlogService],
})
export class BlogModule {}
