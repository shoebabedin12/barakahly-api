import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Repository } from 'typeorm';
import { requestContext } from '../../common/request-context.js';
import { User } from '../../users/user.entity.js';

export interface AdminJwtPayload {
  sub: number;
  email: string;
  /** Set only on 2FA step tokens, which must never work as a session. */
  purpose?: string;
  /** Filled in by the guard from the database, not taken from the token. */
  roleSlug?: string;
}

/**
 * Protects admin-only routes with the JWT issued by AdminAuthService#login.
 * Like Laravel's AdminMiddleware, the account must still exist and have a
 * role - so deleting a staff account or removing its role locks it out
 * immediately rather than when the token expires.
 */
@Injectable()
export class AdminJwtGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    let payload: AdminJwtPayload;
    try {
      payload = await this.jwt.verifyAsync<AdminJwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token.');
    }
    if (payload.purpose) {
      throw new UnauthorizedException('Invalid or expired token.');
    }

    const user = await this.users.findOne({
      where: { id: payload.sub },
      relations: { role: true },
      select: { id: true, role: { id: true, slug: true } },
    });
    if (!user) {
      throw new UnauthorizedException('This account no longer exists.');
    }
    if (!user.role) {
      throw new ForbiddenException('This account has no admin role.');
    }

    (request as Request & { adminUser: AdminJwtPayload }).adminUser = {
      ...payload,
      roleSlug: user.role.slug,
    };
    const ctx = requestContext();
    if (ctx) ctx.adminId = user.id;
    return true;
  }
}
