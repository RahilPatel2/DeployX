/**
 * Security Query and Input Sanitization Utility
 * Guards against ReDoS, MongoDB query injection, and unbounded pagination.
 */

/**
 * Escapes special characters for use in regular expressions to prevent ReDoS.
 */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Sanitizes and bounds a search string.
 * Strips dangerous control characters and enforces a maximum length.
 */
export function sanitizeSearchTerm(term: unknown, maxLength: number = 100): string {
  if (typeof term !== "string") {
    return "";
  }

  // Trim and strip non-printable ASCII control characters (keep standard whitespace)
  const cleaned = term.trim().replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  return cleaned.slice(0, maxLength);
}

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

/**
 * Safely parses and bounds pagination parameters to protect against memory exhaustion.
 */
export function parsePagination(
  searchParams: URLSearchParams,
  defaultLimit: number = 20,
  maxLimit: number = 100
): PaginationParams {
  const pageRaw = searchParams.get("page");
  const limitRaw = searchParams.get("limit");

  let page = parseInt(pageRaw || "1", 10);
  if (isNaN(page) || page < 1) {
    page = 1;
  }

  let limit = parseInt(limitRaw || defaultLimit.toString(), 10);
  if (isNaN(limit) || limit < 1) {
    limit = defaultLimit;
  } else if (limit > maxLimit) {
    limit = maxLimit;
  }

  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

/**
 * Strictly parses and validates sort parameters against a whitelist of safe fields.
 */
export function parseSort<T extends string>(
  searchParams: URLSearchParams,
  allowedFields: readonly T[],
  defaultField: T,
  defaultOrder: "asc" | "desc" = "desc"
): { field: T; order: 1 | -1; sortObject: Record<string, 1 | -1> } {
  const sortByRaw = searchParams.get("sortBy") || searchParams.get("sort");
  const orderRaw = (searchParams.get("order") || searchParams.get("direction") || defaultOrder).toLowerCase();

  const field = (allowedFields.includes(sortByRaw as T) ? sortByRaw : defaultField) as T;
  const order: 1 | -1 = orderRaw === "asc" ? 1 : -1;

  return {
    field,
    order,
    sortObject: { [field]: order },
  };
}
