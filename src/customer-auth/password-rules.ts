/**
 * Password::defaults() from AppServiceProvider - min 8, mixed case, a number
 * and a symbol - plus the `confirmed` rule, with Laravel's messages.
 * Returns the messages for the `password` field (empty when valid).
 */
export function passwordErrors(
  password: unknown,
  confirmation: unknown,
): string[] {
  if (typeof password !== 'string' || password === '')
    return ['The password field is required.'];

  const errors: string[] = [];
  if (password !== confirmation)
    errors.push('The password field confirmation does not match.');
  if (password.length < 8)
    errors.push('The password field must be at least 8 characters.');
  if (!/\p{Lu}/u.test(password) || !/\p{Ll}/u.test(password)) {
    errors.push(
      'The password field must contain at least one uppercase and one lowercase letter.',
    );
  }
  if (!/[\p{Z}\p{S}\p{P}]/u.test(password)) {
    errors.push('The password field must contain at least one symbol.');
  }
  if (!/\p{N}/u.test(password))
    errors.push('The password field must contain at least one number.');
  return errors;
}
