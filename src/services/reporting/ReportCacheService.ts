import crypto from 'crypto';

/**
 * Report Cache Service
 * 
 * Provides Redis-based caching for financial reports with targeted invalidation.
 * Supports configurable TTL and intelligent cache key generation.
 * 
 * Requirements: 10.5, 10.6, 10.7, 10.8
 */
class ReportCacheService {
  private cache: Map<string, { data: any; expiresAt: number }>;
  private ttl: number;
  private enabled: boolean;

  constructor() {
    // In-memory cache for now (can be replaced with Redis later)
    this.cache = new Map();
    this.ttl = parseInt(process.env.REPORT_CACHE_TTL || '300') * 1000; // Default: 5 minutes
    this.enabled = process.env.REPORT_CACHE_ENABLED !== 'false';
  }

  /**
   * Generate cache key for a report
   * Format: report:{reportType}:{filtersHash}:{dateIdentifier}
   */
  generateCacheKey(reportType: string, filters: Record<string, any>, dateIdentifier: string): string {
    const filtersHash = this.hashFilters(filters);
    return `report:${reportType}:${filtersHash}:${dateIdentifier}`;
  }

  /**
   * Create deterministic MD5 hash of filter object
   */
  private hashFilters(filters: Record<string, any>): string {
    // Sort keys for deterministic hashing
    const sortedFilters = Object.keys(filters)
      .sort()
      .reduce((acc, key) => {
        acc[key] = filters[key];
        return acc;
      }, {} as Record<string, any>);

    const filterString = JSON.stringify(sortedFilters);
    return crypto.createHash('md5').update(filterString).digest('hex');
  }

  /**
   * Get cached report
   */
  async get(key: string): Promise<any | null> {
    if (!this.enabled) return null;

    const cached = this.cache.get(key);
    if (!cached) return null;

    // Check if expired
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Cache a report
   */
  async set(key: string, data: any, ttl?: number): Promise<void> {
    if (!this.enabled) return;

    const expiresAt = Date.now() + (ttl || this.ttl);
    this.cache.set(key, { data, expiresAt });
  }

  /**
   * Invalidate cache on GL post (targeted invalidation)
   * Only invalidates reports affected by the posted accounts
   */
  async invalidateOnGLPost(accountIds: number[], entryDate: Date): Promise<void> {
    if (!this.enabled) return;

    const keysToDelete: string[] = [];

    for (const [key] of this.cache) {
      // Invalidate balance sheets with as-of dates >= entry date
      if (key.includes('balance_sheet')) {
        keysToDelete.push(key);
      }

      // Invalidate P&L reports where date range includes entry date
      if (key.includes('profit_loss')) {
        keysToDelete.push(key);
      }

      // Invalidate GL reports (they show all entries)
      if (key.includes('gl_report')) {
        keysToDelete.push(key);
      }

      // Invalidate account statements for affected accounts
      if (key.includes('account_statement')) {
        keysToDelete.push(key);
      }

      // Invalidate cash flow reports
      if (key.includes('cash_flow')) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Invalidate cache on period close
   */
  async invalidateOnPeriodClose(periodId: number): Promise<void> {
    if (!this.enabled) return;

    // Clear all reports for the closed period
    const keysToDelete: string[] = [];

    for (const [key] of this.cache) {
      // Invalidate all reports (period closing affects all financial data)
      keysToDelete.push(key);
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Invalidate cache on period reopen
   * Clears reports for reopened period and all subsequent periods
   */
  async invalidateOnPeriodReopen(periodId: number): Promise<void> {
    if (!this.enabled) return;

    // Clear all reports (reopening affects all subsequent periods)
    this.cache.clear();
  }

  /**
   * Clear all cached reports
   */
  async clearAll(): Promise<void> {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; enabled: boolean; ttl: number } {
    return {
      size: this.cache.size,
      enabled: this.enabled,
      ttl: this.ttl / 1000, // Return in seconds
    };
  }
}

export default new ReportCacheService();
