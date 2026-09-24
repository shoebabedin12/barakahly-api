/**
 * Mirrors Laravel's `asset('storage/' . $path)` helper: builds a public
 * URL for a file on the `storage` symlink, rooted at APP_URL (same env
 * var name/value as the Laravel app, so both backends emit identical
 * URLs for the same file).
 */
export function assetUrl(path: string | null): string | null {
  if (!path) return null;

  const base = (process.env.APP_URL ?? '').replace(/\/+$/, '');

  return `${base}/storage/${path}`;
}
