import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import type { AdminJwtPayload } from './admin-jwt.guard.js';

/** Laravel's SuperAdminMiddleware. Use after AdminJwtGuard: `@UseGuards(AdminJwtGuard, SuperAdminGuard)`. */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { adminUser?: AdminJwtPayload }>();
    if (request.adminUser?.roleSlug !== 'super-admin') {
      throw new ForbiddenException('Only a super admin can do this.');
    }
    return true;
  }
}
