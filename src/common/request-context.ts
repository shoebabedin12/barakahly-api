import { AsyncLocalStorage } from 'node:async_hooks';
import type { NextFunction, Request, Response } from 'express';

interface RequestContext {
  /** The signed-in admin/staff user, set by AdminJwtGuard. */
  adminId: number | null;
}

const storage = new AsyncLocalStorage<RequestContext>();

/** Gives every request its own context, so deep services can see who's acting (Laravel's Auth::id()). */
export function requestContextMiddleware(_req: Request, _res: Response, next: NextFunction) {
  storage.run({ adminId: null }, next);
}

export function requestContext(): RequestContext | undefined {
  return storage.getStore();
}
