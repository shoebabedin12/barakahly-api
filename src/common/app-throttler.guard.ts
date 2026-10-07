import { type ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/**
 * The storefront's server-side renders call this API directly over loopback,
 * so every visitor's SSR request arrives from 127.0.0.1. Rate-limiting that
 * single address would throttle the whole site; only client traffic (which
 * comes through Nginx with X-Forwarded-For) is limited.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override async shouldSkip(
    context: ExecutionContext,
  ): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    return LOOPBACK.has(request.ip ?? '');
  }
}
