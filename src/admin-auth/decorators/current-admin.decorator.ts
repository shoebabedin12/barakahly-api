import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AdminJwtPayload } from '../guards/admin-jwt.guard.js';

export const CurrentAdmin = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AdminJwtPayload => {
    const request = ctx.switchToHttp().getRequest<Request & { adminUser: AdminJwtPayload }>();
    return request.adminUser;
  },
);
