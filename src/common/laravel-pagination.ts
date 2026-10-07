/**
 * The body Laravel returns for a paginated JsonResource collection:
 * `{data, links, meta}`, with page links rooted at APP_URL + path.
 */
export function laravelPaginated<T>(
  data: T[],
  {
    page,
    perPage,
    total,
    path,
  }: { page: number; perPage: number; total: number; path: string },
) {
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const base = `${(process.env.APP_URL ?? '').replace(/\/+$/, '')}${path}`;
  const url = (p: number) => `${base}?page=${p}`;
  const from = data.length ? (page - 1) * perPage + 1 : null;

  return {
    data,
    links: {
      first: url(1),
      last: url(lastPage),
      prev: page > 1 ? url(page - 1) : null,
      next: page < lastPage ? url(page + 1) : null,
    },
    meta: {
      current_page: page,
      from,
      last_page: lastPage,
      links: pageLinks(page, lastPage, url),
      path: base,
      per_page: perPage,
      to: from === null ? null : from + data.length - 1,
      total,
    },
  };
}

/** LengthAwarePaginator::linkCollection - prev, a window of pages, next. */
function pageLinks(page: number, lastPage: number, url: (p: number) => string) {
  const link = (p: number) => ({
    url: url(p),
    label: String(p),
    page: p,
    active: p === page,
  });
  const dots = { url: null, label: '...', page: null, active: false };
  const range = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) => link(from + i));

  // UrlWindow with onEachSide = 3: every page when there are few, otherwise
  // the first two, a slider around the current page, and the last two.
  let pages: {
    url: string | null;
    label: string;
    page: number | null;
    active: boolean;
  }[];
  if (lastPage < 14) pages = range(1, lastPage);
  else if (page <= 7)
    pages = [...range(1, 10), dots, ...range(lastPage - 1, lastPage)];
  else if (page > lastPage - 7)
    pages = [...range(1, 2), dots, ...range(lastPage - 9, lastPage)];
  else
    pages = [
      ...range(1, 2),
      dots,
      ...range(page - 3, page + 3),
      dots,
      ...range(lastPage - 1, lastPage),
    ];

  return [
    {
      url: page > 1 ? url(page - 1) : null,
      label: '&laquo; Previous',
      page: page > 1 ? page - 1 : null,
      active: false,
    },
    ...pages,
    {
      url: page < lastPage ? url(page + 1) : null,
      label: 'Next &raquo;',
      page: page < lastPage ? page + 1 : null,
      active: false,
    },
  ];
}

/** `$request->integer('page')`-style parsing: positive integers only, else the default. */
export function positiveInt(
  value: unknown,
  fallback: number,
  max = Number.MAX_SAFE_INTEGER,
) {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : fallback;
}
