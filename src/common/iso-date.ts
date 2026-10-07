/** Carbon::toIso8601String() for a UTC timestamp: "2026-08-18T09:51:32+00:00". */
export function iso8601(date: Date | null | undefined): string | null {
  return date ? date.toISOString().replace(/\.\d{3}Z$/, '+00:00') : null;
}
