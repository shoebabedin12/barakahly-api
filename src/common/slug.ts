/** Mirrors Laravel's Str::slug() default behaviour closely enough for
 * names typed by admins (ascii, spaces/punctuation -> single hyphens). */
export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
