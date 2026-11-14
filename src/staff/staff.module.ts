import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAuthModule } from '../admin-auth/admin-auth.module.js';
import { Permission } from '../roles/permission.entity.js';
import { Role } from '../roles/role.entity.js';
import { User } from '../users/user.entity.js';
import { RolesController, StaffUsersController } from './staff.controllers.js';
import { RolesService, StaffUsersService } from './staff.services.js';

/** Super-admin-only staff management: accounts, roles and role permissions. */
@Module({
  imports: [TypeOrmModule.forFeature([User, Role, Permission]), AdminAuthModule],
  controllers: [StaffUsersController, RolesController],
  providers: [StaffUsersService, RolesService],
})
export class StaffModule {}
