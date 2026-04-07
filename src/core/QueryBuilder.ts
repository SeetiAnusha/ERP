/**
 * Generic Query Builder
 * Builds dynamic WHERE clauses for Sequelize queries
 * Works with ANY model
 */

import { Op, WhereOptions } from 'sequelize';
import { FilterOptions } from '../types/Pagination';

export class QueryBuilder {
  /**
   * Build dynamic WHERE clause from filter options
   * 
   * @param filters - Filter options including search, date range, and custom filters
   * @returns Sequelize WHERE clause
   * 
   * @example
   * const where = QueryBuilder.buildWhereClause({
   *   search: 'BR0001',
   *   searchFields: ['registrationNumber', 'description'],
   *   dateFrom: '2024-01-01',
   *   dateTo: '2024-12-31',
   *   dateField: 'registrationDate',
   *   transactionType: 'INFLOW'
   * });
   */
  static buildWhereClause(filters: FilterOptions): WhereOptions {
    const where: any = {};
    
    // 1. Search across multiple fields (case-insensitive)
    if (filters.search && filters.searchFields && filters.searchFields.length > 0) {
      where[Op.or] = filters.searchFields.map(field => ({
        [field]: { [Op.iLike]: `%${filters.search}%` }
      }));
    }
    
    // 2. Date range filter
    if (filters.dateFrom || filters.dateTo) {
      const dateField = filters.dateField || 'createdAt';
      where[dateField] = {};
      
      if (filters.dateFrom) {
        const fromDate = typeof filters.dateFrom === 'string' 
          ? new Date(filters.dateFrom) 
          : filters.dateFrom;
        where[dateField][Op.gte] = fromDate;
      }
      
      if (filters.dateTo) {
        const toDate = typeof filters.dateTo === 'string' 
          ? new Date(filters.dateTo) 
          : filters.dateTo;
        // Set to end of day
        toDate.setHours(23, 59, 59, 999);
        where[dateField][Op.lte] = toDate;
      }
    }
    
    // 3. Dynamic filters (exclude pagination and search params)
    const excludedKeys = [
      'search', 'searchFields', 
      'dateFrom', 'dateTo', 'dateField',
      'page', 'limit', 'sortBy', 'sortOrder',
      'filters' // Exclude nested filters object
    ];
    
    Object.keys(filters).forEach(key => {
      if (!excludedKeys.includes(key)) {
        const value = filters[key];
        
        // Skip empty objects and non-empty values check
        if (value !== undefined && value !== null && value !== '' && 
            !(typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0)) {
          // Handle array values (IN operator)
          if (Array.isArray(value)) {
            where[key] = { [Op.in]: value };
          } else {
            where[key] = value;
          }
        }
      }
    });
    
    return where;
  }
  
  /**
   * Build ORDER clause from sort options
   * 
   * @param sortBy - Field to sort by
   * @param sortOrder - Sort direction (ASC or DESC)
   * @returns Sequelize ORDER clause
   */
  static buildOrderClause(sortBy: string = 'createdAt', sortOrder: 'ASC' | 'DESC' = 'DESC'): any[] {
    return [[sortBy, sortOrder]];
  }
  
  /**
   * Validate and sanitize pagination parameters
   * 
   * @param page - Page number
   * @param limit - Records per page
   * @returns Validated pagination params
   */
  static validatePaginationParams(page?: number, limit?: number): { page: number; limit: number; offset: number } {
    const DEFAULT_PAGE = 1;
    const DEFAULT_LIMIT = 50;
    const MIN_LIMIT = 1;
    const MAX_LIMIT = 500;
    
    const validatedPage = Math.max(DEFAULT_PAGE, page || DEFAULT_PAGE);
    const validatedLimit = Math.min(
      Math.max(MIN_LIMIT, limit || DEFAULT_LIMIT),
      MAX_LIMIT
    );
    const offset = (validatedPage - 1) * validatedLimit;
    
    return {
      page: validatedPage,
      limit: validatedLimit,
      offset
    };
  }
}
