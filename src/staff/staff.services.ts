import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Not, Repository } from 'typeorm';
import { ActivityLogService, columnChanges } from '../activity-log/activity-log.service.js';
import { LaravelValidationException } from '../common/laravel-validation.js';
import { requestContext } from '../common/request-context.js';
import { slugify } from '../common/slug.js';
import { hashPassword } from '../customer-auth/customer-auth.service.js';
import { passwordErrors } from '../customer-auth/password-rules.js';
import { Permission } from '../roles/permission.entity.js';
import { Role } from '../roles/role.entity.js';
import { adminPage, orNotFound } from '../store-admin/admin-page.js';
import { User } from '../users/user.entity.js';
import type { RoleDto, StaffUserDto } from './dto/staff.dto.js';

const SUPER_ADMIN = 'super-admin';

/** Admin\UserController - staff accounts (the `users` table). */
@Injectable()
export class StaffUsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    private readonly activity: ActivityLogService,
  ) {}

  private present(user: User) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      roleId: user.roleId,
      role: user.role ? { id: user.role.id, name: user.role.name, slug: user.role.slug } : null,
      twoFactorEnabled: Boolean(user.twoFactorEnabledAt),
      createdAt: user.createdAt,
    };
  }

  async findAll(page: number) {
    const perPage = 15;
    const [rows, total] = await this.users.findAndCount({
      relations: { role: true },
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (page - 1) * perPage,
      take: perPage,
    });
    return adminPage(rows.map((u) => this.present(u)), total, page, perPage);
  }

  async findOne(id: number) {
    return this.present(await this.get(id));
  }

  async create(dto: StaffUserDto) {
    await this.validate(dto, null);
    const user = await this.users.save(
      this.users.create({
        name: dto.name,
        email: dto.email,
        roleId: dto.roleId,
        password: await hashPassword(dto.password as string),
      }),
    );
    await this.activity.record(
      'created',
      { model: 'User', id: user.id, label: user.name },
      `Created staff account "${user.name}" (${user.email})`,
    );
    return this.findOne(user.id);
  }

  async update(id: number, dto: StaffUserDto) {
    const user = await this.get(id);
    await this.validate(dto, id);
    if (user.role?.slug === SUPER_ADMIN && dto.roleId !== user.roleId) await this.assertNotLastSuperAdmin(user);

    const before = { ...user };
    Object.assign(user, { name: dto.name, email: dto.email, roleId: dto.roleId });
    delete (user as Partial<User>).role;
    await this.users.save(user);
    if (dto.password) await this.users.update(id, { password: await hashPassword(dto.password) });

    await this.activity.record(
      'updated',
      { model: 'User', id, label: user.name },
      `Updated staff account "${user.name}"`,
      columnChanges(this.users, before, user, ['password', 'updated_at']),
    );
    return this.findOne(id);
  }

  async remove(id: number) {
    const user = await this.get(id);
    if (user.id === requestContext()?.adminId) {
      throw new BadRequestException('You cannot delete your own account.');
    }
    if (user.role?.slug === SUPER_ADMIN) await this.assertNotLastSuperAdmin(user);
    await this.users.delete(user.id);
    await this.activity.record('deleted', null, `Deleted staff account "${user.name}" (${user.email})`);
  }

  private async get(id: number) {
    return orNotFound(await this.users.findOne({ where: { id }, relations: { role: true } }), 'Staff account');
  }

  private async validate(dto: StaffUserDto, id: number | null) {
    const errors: Record<string, string[]> = {};
    if (await this.users.existsBy({ email: dto.email, ...(id ? { id: Not(id) } : {}) }))
      errors.email = ['The email has already been taken.'];
    if (!(await this.roles.existsBy({ id: dto.roleId }))) errors.roleId = ['The selected role is invalid.'];
    if (id === null || dto.password) {
      const problems = passwordErrors(dto.password, dto.passwordConfirmation);
      if (problems.length) errors.password = problems.slice(0, 1);
    }
    if (Object.keys(errors).length) throw new LaravelValidationException(errors);
  }

  /** Never leave the panel without a super admin (deleting or demoting the last one). */
  private async assertNotLastSuperAdmin(user: User) {
    const count = await this.users.count({ where: { role: { slug: SUPER_ADMIN } } });
    if (count <= 1) {
      throw new BadRequestException(`"${user.name}" is the last super admin account.`);
    }
  }
}

/** Admin\RoleController - roles and their permissions. */
@Injectable()
export class RolesService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    @InjectRepository(Permission) private readonly permissions: Repository<Permission>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly activity: ActivityLogService,
  ) {}

  async findAll(page: number) {
    const perPage = 15;
    const [rows, total] = await this.roles.findAndCount({
      order: { name: 'ASC' },
      skip: (page - 1) * perPage,
      take: perPage,
    });
    const ids = rows.map((r) => r.id);
    const [counts, links] = await Promise.all([
      ids.length
        ? this.users
            .createQueryBuilder('u')
            .select('u.role_id', 'roleId')
            .addSelect('COUNT(*)', 'n')
            .where('u.role_id IN (:...ids)', { ids })
            .groupBy('u.role_id')
            .getRawMany<{ roleId: number; n: string }>()
        : [],
      this.permissionLinks(ids),
    ]);
    const data = rows.map((r) => ({
      ...r,
      usersCount: Number(counts.find((c) => Number(c.roleId) === r.id)?.n ?? 0),
      permissions: links.filter((l) => l.roleId === r.id).map(({ id, name, slug }) => ({ id, name, slug })),
    }));
    return adminPage(data, total, page, perPage);
  }

  async findOne(id: number) {
    const role = await this.get(id);
    const links = await this.permissionLinks([id]);
    return { ...role, permissionIds: links.map((l) => l.id) };
  }

  options() {
    return this.roles.find({ select: { id: true, name: true, slug: true }, order: { name: 'ASC' } });
  }

  allPermissions() {
    return this.permissions.find({ order: { name: 'ASC' } });
  }

  create(dto: RoleDto) {
    return this.dataSource.transaction(async (manager) => {
      await this.validate(dto, null);
      const role = await manager.save(manager.create(Role, { name: dto.name, slug: slugify(dto.name) }));
      await this.syncPermissions(manager, role.id, dto.permissionIds ?? []);
      return role;
    }).then(async (role) => {
      await this.activity.record(
        'created',
        { model: 'Role', id: role.id, label: role.name },
        `Created role "${role.name}" with ${dto.permissionIds?.length ?? 0} permission(s)`,
      );
      return this.findOne(role.id);
    });
  }

  async update(id: number, dto: RoleDto) {
    const role = await this.get(id);
    // Renaming would change the slug the panel's super-admin check relies on.
    if (role.slug === SUPER_ADMIN && slugify(dto.name) !== SUPER_ADMIN) {
      throw LaravelValidationException.field('name', 'The Super Admin role cannot be renamed.');
    }
    await this.dataSource.transaction(async (manager) => {
      await this.validate(dto, id);
      await manager.update(Role, id, { name: dto.name, slug: slugify(dto.name) });
      await this.syncPermissions(manager, id, dto.permissionIds ?? []);
    });
    await this.activity.record(
      'updated',
      { model: 'Role', id, label: dto.name },
      `Updated role "${dto.name}" permissions (${dto.permissionIds?.length ?? 0} permission(s) now assigned)`,
    );
    return this.findOne(id);
  }

  async remove(id: number) {
    const role = await this.get(id);
    if (role.slug === SUPER_ADMIN) throw new BadRequestException('The Super Admin role cannot be deleted.');
    if (await this.users.existsBy({ roleId: id })) {
      throw new ConflictException('Cannot delete a role that still has users assigned to it.');
    }
    await this.dataSource.transaction(async (manager) => {
      await manager.query('DELETE FROM `permission_role` WHERE `role_id` = ?', [id]);
      await manager.delete(Role, id);
    });
    await this.activity.record('deleted', null, `Deleted role "${role.name}"`);
  }

  private async get(id: number) {
    return orNotFound(await this.roles.findOneBy({ id }), 'Role');
  }

  private async validate(dto: RoleDto, id: number | null) {
    const errors: Record<string, string[]> = {};
    const notMe = id ? { id: Not(id) } : {};
    if (await this.roles.existsBy({ name: dto.name, ...notMe })) errors.name = ['The name has already been taken.'];
    else if (await this.roles.existsBy({ slug: slugify(dto.name), ...notMe }))
      errors.name = ['A role with a very similar name already exists.'];
    const ids = [...new Set(dto.permissionIds ?? [])];
    if (ids.length && (await this.permissions.countBy({ id: In(ids) })) !== ids.length)
      errors.permissionIds = ['The selected permissions are invalid.'];
    if (Object.keys(errors).length) throw new LaravelValidationException(errors);
  }

  /** $role->permissions()->sync($ids). */
  private async syncPermissions(manager: DataSource['manager'], roleId: number, permissionIds: number[]) {
    await manager.query('DELETE FROM `permission_role` WHERE `role_id` = ?', [roleId]);
    const ids = [...new Set(permissionIds)];
    if (ids.length) {
      const now = new Date();
      await manager.query(
        `INSERT INTO \`permission_role\` (\`role_id\`, \`permission_id\`, \`created_at\`, \`updated_at\`) VALUES ${ids.map(() => '(?, ?, ?, ?)').join(', ')}`,
        ids.flatMap((pid) => [roleId, pid, now, now]),
      );
    }
  }

  private async permissionLinks(roleIds: number[]) {
    if (!roleIds.length) return [];
    const rows: { roleId: number; id: number; name: string; slug: string }[] = await this.dataSource.query(
      `SELECT pr.role_id AS roleId, p.id, p.name, p.slug
         FROM permission_role pr JOIN permissions p ON p.id = pr.permission_id
        WHERE pr.role_id IN (?) ORDER BY p.name`,
      [roleIds],
    );
    return rows.map((r) => ({ ...r, roleId: Number(r.roleId), id: Number(r.id) }));
  }
}
