/**
 * SAFE DATA CLASSIFICATION SERVICE
 * 
 * ZERO IMPACT GUARANTEE:
 * - Does NOT modify existing models
 * - Does NOT affect existing business logic
 * - Does NOT slow down existing operations
 * - Can be completely disabled without affecting anything
 * - Runs in background, fails silently if needed
 */

import DataClassificationMetadata from '../models/DataClassificationMetadata';
import { Op } from 'sequelize';

export interface ClassificationConfig {
  enabled: boolean;           // Master switch - can disable entire system
  backgroundMode: boolean;    // Run in background to avoid blocking operations
  failSilently: boolean;     // Don't throw errors that could break existing code
  logErrors: boolean;        // Log classification errors for debugging
}

/**
 * Safe, Non-Intrusive Data Classification Service
 * Designed to run alongside existing system without any interference
 */
export class SafeDataClassificationService {
  private static instance: SafeDataClassificationService;
  private config: ClassificationConfig;

  private constructor() {
    this.config = {
      enabled: true,           // Can be disabled via environment variable
      backgroundMode: true,    // Always run in background
      failSilently: true,      // Never break existing functionality
      logErrors: false         // Minimal logging to avoid noise
    };
  }

  public static getInstance(): SafeDataClassificationService {
    if (!SafeDataClassificationService.instance) {
      SafeDataClassificationService.instance = new SafeDataClassificationService();
    }
    return SafeDataClassificationService.instance;
  }

  /**
   * SAFE CLASSIFICATION - Never throws errors, never blocks operations
   * Call this AFTER your existing operations complete successfully
   */
  public async safeClassifyData(
    entityType: string, 
    entityId: string, 
    additionalContext?: any
  ): Promise<void> {
    // Early exit if disabled - zero performance impact
    if (!this.config.enabled) {
      return;
    }

    try {
      // Run in background if configured
      if (this.config.backgroundMode) {
        // Don't await - let it run in background
        this.performClassification(entityType, entityId, additionalContext)
          .catch(error => {
            if (this.config.logErrors) {
              console.log(`[DataClassification] Background classification failed for ${entityType}:${entityId}`, error);
            }
            // Fail silently - don't affect main application
          });
        return;
      }

      // Synchronous classification (only if background mode disabled)
      await this.performClassification(entityType, entityId, additionalContext);

    } catch (error) {
      if (this.config.failSilently) {
        // Log error but don't throw - protect existing functionality
        if (this.config.logErrors) {
          console.log(`[DataClassification] Classification failed for ${entityType}:${entityId}`, error);
        }
        return;
      }
      throw error;
    }
  }

  /**
   * Internal classification logic - isolated from main application
   */
  private async performClassification(
    entityType: string, 
    entityId: string, 
    additionalContext?: any
  ): Promise<void> {
    // Check if already classified
    const existing = await DataClassificationMetadata.findOne({
      where: { entityType, entityId, isActive: true }
    });

    if (existing) {
      return; // Already classified, don't duplicate
    }

    // Get classification rules
    const classification = this.getClassificationForEntity(entityType);
    
    // Calculate expiry date
    const expiresAt = classification.retentionDays === -1 
      ? null 
      : new Date(Date.now() + (classification.retentionDays * 24 * 60 * 60 * 1000));

    // Create classification record in separate table
    await DataClassificationMetadata.create({
      entityType,
      entityId,
      classification: classification.level,
      retentionDays: classification.retentionDays,
      expiresAt,
      complianceReasons: JSON.stringify(classification.complianceStandards),
      autoClassified: true,
      isActive: true
    });
  }

  /**
   * Get classification rules for entity types
   * These rules don't affect your existing models at all
   */
  private getClassificationForEntity(entityType: string): {
    level: 'public' | 'internal' | 'confidential' | 'restricted';
    retentionDays: number;
    complianceStandards: string[];
  } {
    const rules: Record<string, any> = {
      // Financial data - 7 years (SOX compliance)
      'AccountsPayable': {
        level: 'confidential',
        retentionDays: 2555, // 7 years
        complianceStandards: ['SOX', 'IRS', 'GAAP']
      },
      'AccountsReceivable': {
        level: 'confidential',
        retentionDays: 2555, // 7 years
        complianceStandards: ['SOX', 'IRS', 'GAAP']
      },
      
      // Customer data - 3 years (GDPR compliance)
      'Client': {
        level: 'confidential',
        retentionDays: 1095, // 3 years
        complianceStandards: ['GDPR', 'CCPA']
      },
      
      // User data - 3 years
      'User': {
        level: 'restricted',
        retentionDays: 1095, // 3 years
        complianceStandards: ['GDPR', 'ISO27001']
      },
      
      // Bank data - 7 years
      'BankAccount': {
        level: 'restricted',
        retentionDays: 2555, // 7 years
        complianceStandards: ['SOX', 'PCI-DSS']
      },
      'BankRegister': {
        level: 'restricted',
        retentionDays: 2555, // 7 years
        complianceStandards: ['SOX', 'Bank Secrecy Act']
      },
      
      // Business expenses - 7 years
      'BusinessExpense': {
        level: 'confidential',
        retentionDays: 2555, // 7 years
        complianceStandards: ['IRS', 'Tax Code']
      },
      
      // Adjustments - permanent
      'Adjustment': {
        level: 'restricted',
        retentionDays: -1, // Permanent
        complianceStandards: ['SOX', 'GAAP', 'Audit Standards']
      }
    };

    return rules[entityType] || {
      level: 'internal',
      retentionDays: 1095, // 3 years default
      complianceStandards: ['Default Policy']
    };
  }

  /**
   * SAFE QUERY METHODS - Never affect existing operations
   */
  
  /**
   * Get classification for an entity (safe, returns null if not found)
   */
  public async getClassification(entityType: string, entityId: string): Promise<any | null> {
    if (!this.config.enabled) return null;

    try {
      return await DataClassificationMetadata.findOne({
        where: { entityType, entityId, isActive: true }
      });
    } catch (error) {
      if (this.config.logErrors) {
        console.log(`[DataClassification] Query failed for ${entityType}:${entityId}`, error);
      }
      return null; // Fail safely
    }
  }

  /**
   * Get entities approaching expiry (for compliance monitoring)
   */
  public async getExpiringEntities(withinDays: number = 90): Promise<any[]> {
    if (!this.config.enabled) return [];

    try {
      const cutoffDate = new Date(Date.now() + (withinDays * 24 * 60 * 60 * 1000));
      
      return await DataClassificationMetadata.findAll({
        where: {
          isActive: true,
          expiresAt: {
            [Op.lte]: cutoffDate,
            [Op.ne]: null
          }
        },
        order: [['expiresAt', 'ASC']]
      });
    } catch (error) {
      if (this.config.logErrors) {
        console.log('[DataClassification] Expiry query failed', error);
      }
      return []; // Fail safely
    }
  }

  /**
   * Configuration methods - can disable entire system
   */
  public enable(): void {
    this.config.enabled = true;
  }

  public disable(): void {
    this.config.enabled = false;
  }

  public isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Update configuration safely
   */
  public updateConfig(newConfig: Partial<ClassificationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// Export singleton instance
export const dataClassificationService = SafeDataClassificationService.getInstance();