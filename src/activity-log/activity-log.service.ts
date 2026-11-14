import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, type ObjectLiteral, Repository } from 'typeorm';
import { requestContext } from '../common/request-context.js';
import { adminPage } from '../store-admin/admin-page.js';
import { User } from '../users/user.entity.js';
import { ActivityLog } from './activity-log.entity.js';

/** What an entry is about: the Laravel model name, its id and a readable label. */
export interface ActivitySubject {
  model: 'Product' | 'Order' | 'Coupon' | 'BlogPost' | 'Setting' | 'Customer' | 'User' | 'Role';
  id: number;
  label?: string | null;
}

export interface ActivityFilters {
  userId?: number;
  action?: string;
  dateFrom?: string;
  dateTo?: string;
}

@Injectable()
export class ActivityLogService {
  private readonly logger = new Logger(ActivityLogService.name);

  constructor(
    @InjectRepository(ActivityLog) private readonly logs: Repository<ActivityLog>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  /**
   * ActivityLog::record() - who did what. The actor comes from the request
   * (set by AdminJwtGuard). A failed write is logged, never thrown: the
   * admin's actual change has already happened by now.
   */
  async record(
    action: string,
    subject: ActivitySubject | null,
    description: string,
    changes: Record<string, unknown> | null = null,
  ) {
    try {
      await this.logs.save(
        this.logs.create({
          userId: requestContext()?.adminId ?? null,
          action,
          subjectType: subject ? `App\\Models\\${subject.model}` : null,
          subjectId: subject?.id ?? null,
          subjectLabel: subject?.label ?? null,
          description,
          changes: changes && Object.keys(changes).length > 0 ? changes : null,
        }),
      );
    } catch (err) {
      this.logger.error(`Could not record activity "${description}": ${String(err)}`);
    }
  }

  async findAll(page: number, filters: ActivityFilters) {
    const perPage = 30;
    const query = this.logs
      .createQueryBuilder('l')
      .leftJoin('l.user', 'u')
      .addSelect(['u.id', 'u.name', 'u.email'])
      .orderBy('l.created_at', 'DESC')
      .addOrderBy('l.id', 'DESC')
      .skip((page - 1) * perPage)
      .take(perPage);
    if (filters.userId) query.andWhere('l.user_id = :userId', { userId: filters.userId });
    if (filters.action) query.andWhere('l.action = :action', { action: filters.action });
    // Laravel's whereDate() on UTC timestamps, so compare in Dhaka time like the admin sees them.
    if (filters.dateFrom || filters.dateTo) {
      query.andWhere(
        new Brackets((q) => {
          if (filters.dateFrom)
            q.andWhere("DATE(CONVERT_TZ(l.created_at, '+00:00', '+06:00')) >= :from", { from: filters.dateFrom });
          if (filters.dateTo)
            q.andWhere("DATE(CONVERT_TZ(l.created_at, '+00:00', '+06:00')) <= :to", { to: filters.dateTo });
        }),
      );
    }
    const [[rows, total], users, actions] = await Promise.all([
      query.getManyAndCount(),
      this.users.find({ select: { id: true, name: true }, order: { name: 'ASC' } }),
      this.logs
        .createQueryBuilder('l')
        .select('DISTINCT l.action', 'action')
        .orderBy('action', 'ASC')
        .getRawMany<{ action: string }>()
        .then((r) => r.map((a) => a.action)),
    ]);
    return { ...adminPage(rows, total, page, perPage), users, actions };
  }
}

/**
 * Eloquent's getChanges(): the columns whose value changed, keyed by
 * database column name, with their new values.
 */
export function columnChanges<T extends ObjectLiteral>(
  repo: Repository<T>,
  before: Partial<T>,
  after: Partial<T>,
  ignore: string[] = [],
) {
  const changes: Record<string, unknown> = {};
  for (const column of repo.metadata.columns) {
    const key = column.propertyName as keyof T;
    if (!(key in after) || ignore.includes(column.databaseName)) continue;
    const a = normalise(before[key]);
    const b = normalise(after[key]);
    if (a !== b) changes[column.databaseName] = after[key] ?? null;
  }
  return changes;
}

function normalise(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (value === undefined) return null;
  return typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value as string | number | boolean);
}

