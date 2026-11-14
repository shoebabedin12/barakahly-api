import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from '../roles/role.entity.js';
import { User } from '../users/user.entity.js';
import { AdminAuthController } from './admin-auth.controller.js';
import { AdminAuthService } from './admin-auth.service.js';
import { AdminJwtGuard } from './guards/admin-jwt.guard.js';
import { SuperAdminGuard } from './guards/super-admin.guard.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Role]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('ADMIN_JWT_SECRET'),
        signOptions: { expiresIn: '12h' },
      }),
    }),
  ],
  controllers: [AdminAuthController],
  providers: [AdminAuthService, AdminJwtGuard, SuperAdminGuard],
  // TypeOrmModule so every module using AdminJwtGuard can inject its User repository.
  exports: [AdminJwtGuard, SuperAdminGuard, JwtModule, TypeOrmModule],
})
export class AdminAuthModule {}
