import AuditLog from '../../models/accounting/AuditLog';
import { AuditLogEntry, AuditLogFilters, AuditLogQueryResult } from '../../types/reporting';
import { Op } from 'sequelize';

/**
 * Audit Log Service
 * 
 * Provides comprehensive audit trail for all privileged operations.
 * Handles logging, querying, and access validation.
 * 
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.9
 */
class AuditLogService {
  /**
   * Log an audit entry
   * Handles database write failures gracefully (logs to console, doesn't throw)
   * 
   * @param entry - Audit log entry details
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await AuditLog.create({
        timestamp: new Date(),
        userId: entry.userId,
        actionType: entry.actionType,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        details: entry.details,
        ipAddress: entry.ipAddress,
        success: entry.success !== undefined ? entry.success : true,
      });
    } catch (error) {
      // Log to console but don't throw - audit logging should not break operations
      console.error('Failed to write audit log entry:', error);
      console.error('Audit entry details:', entry);
    }
  }

  /**
   * Query audit log entries with filtering and pagination
   * 
   * @param filters - Query filters
   * @returns Audit log query result with entries and pagination info
   */
  async query(filters: AuditLogFilters): Promise<AuditLogQueryResult> {
    const where: any = {};

    // Apply filters
    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) {
        where.timestamp[Op.gte] = filters.startDate;
      }
      if (filters.endDate) {
        where.timestamp[Op.lte] = filters.endDate;
      }
    }

    if (filters.userId !== undefined) {
      where.userId = filters.userId;
    }

    if (filters.actionType) {
      where.actionType = filters.actionType;
    }

    if (filters.resourceType) {
      where.resourceType = filters.resourceType;
    }

    if (filters.success !== undefined) {
      where.success = filters.success;
    }

    // Get total count
    const totalCount = await AuditLog.count({ where });

    // Get paginated entries
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const entries = await AuditLog.findAll({
      where,
      limit,
      offset,
      order: [['timestamp', 'DESC']],
    });

    return {
      entries: entries.map(entry => ({
        id: entry.id,
        timestamp: entry.timestamp,
        userId: entry.userId,
        actionType: entry.actionType,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        details: entry.details,
        ipAddress: entry.ipAddress,
        success: entry.success,
      })),
      totalCount,
      hasMore: offset + limit < totalCount,
    };
  }

  /**
   * Validate user access based on role
   * 
   * @param userRole - User's role
   * @param requiredRole - Required role for the operation
   * @returns True if access granted, false otherwise
   */
  validateAccess(userRole: string, requiredRole: string): boolean {
    const roleHierarchy: Record<string, number> = {
      'VIEWER': 1,
      'ACCOUNTANT': 2,
      'ADMINISTRATOR': 3,
    };

    const userLevel = roleHierarchy[userRole] || 0;
    const requiredLevel = roleHierarchy[requiredRole] || 0;

    return userLevel >= requiredLevel;
  }
}

export default new AuditLogService();
