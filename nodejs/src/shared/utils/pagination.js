import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "#config/constants";

export function normalizePagination(input = {}) {
  const page = Math.max(Number(input.page || 1), 1);
  const perPage = Math.min(
    Math.max(Number(input.perPage || DEFAULT_PAGE_SIZE), 1),
    MAX_PAGE_SIZE
  );

  return {
    page,
    perPage,
    offset: (page - 1) * perPage
  };
}
