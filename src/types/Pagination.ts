/**
 * Generic Pagination Types
 * Used across all services for consistent pagination
 */

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface PaginationMetadata {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  from: number;
  to: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMetadata;
}

export interface FilterOptions {
  // Search
  search?: string;
  searchFields?: string[];
  
  // Date range
  dateFrom?: Date | string;
  dateTo?: Date | string;
  dateField?: string;
  
  // Dynamic filters (any additional filters)
  [key: string]: any;
}

export interface QueryOptions extends PaginationOptions, FilterOptions {}

// Default pagination values
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 50;
export const MIN_LIMIT = 1;
export const MAX_LIMIT = 500;
export const DEFAULT_SORT_ORDER = 'DESC';
