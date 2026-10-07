import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Customer } from '../customers/customer.entity.js';
import { SanctumTokenService } from './sanctum-token.service.js';

export type CustomerRequest = Request & {
  customer?: Customer;
  customerTokenId?: number;
};

function bearerToken(request: Request): string | null {
  const header = request.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7).trim() : null;
}

/** `auth:sanctum` - rejects the request unless it carries a valid customer token. */
@Injectable()
export class CustomerAuthGuard implements CanActivate {
  constructor(private readonly tokens: SanctumTokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<CustomerRequest>();
    const resolved = await this.tokens.resolve(bearerToken(request));

    if (!resolved) {
      throw new UnauthorizedException({ message: 'Unauthenticated.' });
    }

    request.customer = resolved.customer;
    request.customerTokenId = resolved.tokenId;
    return true;
  }
}

/**
 * `$request->user('sanctum')` on guest-friendly routes: attaches the customer
 * when the token is valid, and lets the request through either way.
 */
@Injectable()
export class OptionalCustomerGuard implements CanActivate {
  constructor(private readonly tokens: SanctumTokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<CustomerRequest>();
    const resolved = await this.tokens.resolve(bearerToken(request));

    if (resolved) {
      request.customer = resolved.customer;
      request.customerTokenId = resolved.tokenId;
    }
    return true;
  }
}

/** The signed-in customer (undefined on guest requests behind OptionalCustomerGuard). */
export const CurrentCustomer = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<CustomerRequest>().customer,
);
