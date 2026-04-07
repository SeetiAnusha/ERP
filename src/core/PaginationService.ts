/**
 * Generic Pagination Service
 * Provides reusable pagination logic for ALL Sequelize models
 * 
 * Usage:
 * const result = await PaginationService.paginate(BankRegister, options, whereClause);
 */

import { Model, ModelStatic, WhereOptions, Includeable, Order } from 'sequelize';
import { PaginatedResponse, PaginationMetadata, QueryOptions } from '../types/Pagination';
import { QueryBuilder } from './QueryBuilder';

export class PaginationService {
  /**
   * Generic pagination method that works with ANY Sequelize model
   * 
   * @param model - Sequelize model class (e.g., BankRegister, Purchase, Supplier)
   * @param options - Query options (pagination, filters, search)
   * @param whereClause - Additional WHERE conditions (optional)
   * @param include - Sequelize include/associations (optional)
   * @returns Paginated response with data and metadata
   * 
   * @example
   * // Simple pagination
   * const result = await PaginationService.paginate(BankRegister, { page: 1, limit: 50 });
   * 
   * @example
   * // With filters
   * const result = await PaginationService.paginate(
   *   BankRegister,
   *   { 
   *     page: 1, 
   *     limit: 50,
   *     search: 'BR0001',
   *     searchFields: ['registrationNumber'],
   *     transactionType: 'INFLOW'
   *   }
   * );
   * 
   * @example
   * // With associations
   * const result = await PaginationService.paginate(
   *   Purchase,
   *   { page: 1, limit: 50 },
   *   {},
   *   [{ model: Supplier, as: 'supplier' }]
   * );
   */
  static async paginate<T extends Model>(
    model: ModelStatic<T>,
    options: QueryOptions = {},
    additionalWhere: WhereOptions = {},
    include: Includeable[] = []
  ): Promise<PaginatedResponse<T>> {
    
    // 1. Validate and sanitize pagination parameters
    const { page, limit, offset } = QueryBuilder.validatePaginationParams(
      options.page,
      options.limit
    );
    
    // 2. Build WHERE clause from filters
    const filterWhere = QueryBuilder.buildWhereClause(options);
    
    // 3. Merge filter WHERE with additional WHERE
    const whereClause: WhereOptions = {
      ...filterWhere,
      ...additionalWhere
    };
    
    // 4. Build ORDER clause
    const order: Order = QueryBuilder.buildOrderClause(
      options.sortBy,
      options.sortOrder
    );
    
    // 5. Execute query with pagination
    const { rows: data, count: total } = await model.findAndCountAll({
      where: whereClause,
      include,
      order,
      limit,
      offset,
      distinct: true, // Important for accurate count with joins
      subQuery: false // Better performance for complex queries
    });
    
    // 6. Calculate pagination metadata
    const pagination = this.calculatePaginationMetadata(total, page, limit);
    
    // 7. Return paginated response
    return {
      data,
      pagination
    };
  }
  
  /**
   * Calculate pagination metadata
   * 
   * @param total - Total number of records
   * @param page - Current page number
   * @param limit - Records per page
   * @returns Pagination metadata
   */
  private static calculatePaginationMetadata(
    total: number,
    page: number,
    limit: number
  ): PaginationMetadata {
    const totalPages = Math.ceil(total / limit);
    const from = total > 0 ? (page - 1) * limit + 1 : 0;
    const to = Math.min(page * limit, total);
    
    return {
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
      from,
      to
    };
  }
  
  /**
   * Paginate with custom count query
   * Useful when count query needs to be different from data query
   * 
   * @param model - Sequelize model class
   * @param options - Query options
   * @param dataQuery - Custom query for fetching data
   * @param countQuery - Custom query for counting records
   * @returns Paginated response
   */
  static async paginateCustom<T extends Model>(
    model: ModelStatic<T>,
    options: QueryOptions,
    dataQuery: any,
    countQuery: any
  ): Promise<PaginatedResponse<T>> {
    
    const { page, limit, offset } = QueryBuilder.validatePaginationParams(
      options.page,
      options.limit
    );
    
    // Execute both queries in parallel
    const [data, total] = await Promise.all([
      model.findAll({
        ...dataQuery,
        limit,
        offset
      }),
      model.count(countQuery)
    ]);
    
    // ✅ FIX: Handle GroupedCountResultItem[] type from count with group
    const totalCount = Array.isArray(total) ? total.length : total;
    const pagination = this.calculatePaginationMetadata(totalCount, page, limit);
    
    return {
      data,
      pagination
    };
  }
}
