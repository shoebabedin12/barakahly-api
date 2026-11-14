import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AdminJwtGuard } from '../admin-auth/guards/admin-jwt.guard.js';
import { SuperAdminGuard } from '../admin-auth/guards/super-admin.guard.js';
import { pageNumber } from '../store-admin/admin-page.js';
import { RoleDto, StaffUserDto } from './dto/staff.dto.js';
import { RolesService, StaffUsersService } from './staff.services.js';

@Controller('api/v1/admin/users')
@UseGuards(AdminJwtGuard, SuperAdminGuard)
export class StaffUsersController {
  constructor(
    private readonly service: StaffUsersService,
    private readonly roles: RolesService,
  ) {}

  @Get()
  findAll(@Query('page') page?: string) {
    return this.service.findAll(pageNumber(page));
  }

  /** Every role, for the role dropdown. */
  @Get('role-options')
  roleOptions() {
    return this.roles.options();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: StaffUserDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: StaffUserDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.service.remove(id);
    return { message: 'Staff account deleted successfully.' };
  }
}

@Controller('api/v1/admin/roles')
@UseGuards(AdminJwtGuard, SuperAdminGuard)
export class RolesController {
  constructor(private readonly service: RolesService) {}

  @Get()
  findAll(@Query('page') page?: string) {
    return this.service.findAll(pageNumber(page));
  }

  @Get('permissions')
  permissions() {
    return this.service.allPermissions();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: RoleDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: RoleDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.service.remove(id);
    return { message: 'Role deleted successfully.' };
  }
}
