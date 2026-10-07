import {
  HttpException,
  HttpStatus,
  type ValidationError,
} from '@nestjs/common';

/**
 * Laravel's validation error response: HTTP 422 with the first message as
 * `message` (plus "(and N more errors)") and every message keyed by field
 * under `errors`. The storefront and the mobile app read exactly this shape,
 * and the admin panel only reads `message`, so every route uses it.
 */
export class LaravelValidationException extends HttpException {
  constructor(errors: Record<string, string[]>) {
    const messages = Object.values(errors).flat();
    const extra = messages.length - 1;
    const message =
      extra > 0
        ? `${messages[0]} (and ${extra} more error${extra === 1 ? '' : 's'})`
        : (messages[0] ?? 'The given data was invalid.');

    super({ message, errors }, HttpStatus.UNPROCESSABLE_ENTITY);
  }

  /** Shortcut for a single-field error, like ValidationException::withMessages(). */
  static field(field: string, message: string) {
    return new LaravelValidationException({ [field]: [message] });
  }
}

function collect(
  errors: ValidationError[],
  prefix: string,
  out: Record<string, string[]>,
) {
  for (const error of errors) {
    const key = prefix ? `${prefix}.${error.property}` : error.property;
    if (error.constraints) {
      // Laravel stops at the first failing rule; "required" comes before any
      // type or format rule, so report that one when it failed.
      const { isNotEmpty, isDefined, ...rest } = error.constraints;
      out[key] = [isNotEmpty ?? isDefined ?? Object.values(rest)[0]];
    }
    if (error.children?.length) collect(error.children, key, out);
  }
  return out;
}

export function laravelValidationFactory(errors: ValidationError[]) {
  return new LaravelValidationException(collect(errors, '', {}));
}
