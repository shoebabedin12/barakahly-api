import { NotFoundException } from '@nestjs/common';

/** The `{data, meta}` page shape every admin list endpoint returns. */
export function adminPage<T>(
  data: T[],
  total: number,
  page: number,
  perPage: number,
) {
  return {
    data,
    meta: {
      page,
      perPage,
      total,
      lastPage: Math.max(1, Math.ceil(total / perPage)),
    },
  };
}

export function pageNumber(value: string | undefined) {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function orNotFound<T>(row: T | null, label: string): T {
  if (!row) throw new NotFoundException(`${label} not found.`);
  return row;
}

export const money = (value: number | null | undefined) =>
  value === null || value === undefined ? null : value.toFixed(2);
