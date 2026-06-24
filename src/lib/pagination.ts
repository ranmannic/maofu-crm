import { DEFAULT_PAGE_SIZE } from "./constants";

export function parsePagination(
  searchParams: URLSearchParams,
  defaultPageSize = DEFAULT_PAGE_SIZE
) {
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("pageSize") || String(defaultPageSize), 10))
  );
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number
) {
  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 1,
    },
  };
}
