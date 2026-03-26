/**
 * Professional Data Classification System
 * Automatically classifies and manages data retention for ERP system
 * Ensures compliance with GDPR, SOX, and other regulations
 */

export enum DataClassification {
  PUBLIC = 'public',           // Marketing materials, public reports
  INTERNAL = 'internal',       // Internal reports, employee communications  
  CONFIDENTIAL = 'confidential', // Financial data, customer PII
  RESTRICTED = 'restricted'    // Audit logs, legal documents, sensitive financial data
}

export enum RetentionPeriod {
  ONE_YEAR = 365,
  THREE_YEARS = 1095,
  SEVEN_YEARS = 2555,         // SOX compliance for financial records
  PERMANENT = -1              // Legal requirements, audit trails
}

export interface ClassificationRule {
  entityType: string;
  classification: DataClassification;
  retentionDays: RetentionPeriod;
  reason: string;
  complianceStandard: string[];
}

export interface DataClassificationMetadata {
  id: string;
  entityType: string;
  entityId: string;
  classification: DataClassification;
  retentionDays: RetentionPeriod;
  classifiedAt: Date;
  expiresAt: Date | null;
  complianceReasons: string[];
  autoClassified: boolean;
}

/**
 * Core Data Classification Service
 * Handles automatic classification, retention policies, and compliance monitoring
 */
export class DataClassificationService {
  private static instance: DataClassificationService;
  private classificationRules: Map<string, ClassificationRule> = new Map();

  private constructor() {
    this.initializeDefaultRules();
  }

  public static getInstance(): DataClassificationService {
    if (!DataClassificationService.instance) {
      DataClassificationService.instance = new DataClassificationService();
    }
    return DataClassificationService.instance;
  }

  /**
   * Initialize default classification rules for ERP entities
   * Based on industry standards and compliance requirements
   */
  private initializeDefaultRules(): void {
    // Financial Data - SOX Compliance (7 years)
    this.addRule('AccountsPayable', {
      entityType: 'AccountsPayable',
      classification: DataClassification.CONFIDENTIAL,
      retentionDays: RetentionPeriod.SEVEN_YEARS,
      reason: 'Financial transaction records required for audit compliance',
      complianceStandard: ['SOX', 'IRS', 'GAAP']
    });

    this.addRule('AccountsReceivable', {
      entityType: 'AccountsReceivable',
      classification: DataClassification.CONFIDENTIAL,
      retentionDays: RetentionPeriod.SEVEN_YEARS,
      reason: 'Revenue recognition and audit trail requirements',
      complianceStandard: ['SOX', 'IRS', 'GAAP']
    });

    // Customer Data - GDPR Compliance (3 years default)
    this.addRule('Client', {
      entityType: 'Client',
      classification: DataClassification.CONFIDENTIAL,
      retentionDays: RetentionPeriod.THREE_YEARS,
      reason: 'Customer PII protection under data privacy laws',
      complianceStandard: ['GDPR', 'CCPA', 'PIPEDA']
    });

    // User Authentication - Security Critical
    this.addRule('User', {
      entityType: 'User',
      classification: DataClassification.RESTRICTED,
      retentionDays: RetentionPeriod.THREE_YEARS,
      reason: 'Authentication and access control records',
      complianceStandard: ['ISO27001', 'NIST', 'SOC2']
    });

    // Bank Records - Financial Compliance
    this.addRule('BankAccount', {
      entityType: 'BankAccount',
      classification: DataClassification.RESTRICTED,
      retentionDays: RetentionPeriod.SEVEN_YEARS,
      reason: 'Banking relationship and transaction records',
      complianceStandard: ['SOX', 'PCI-DSS', 'Bank Secrecy Act']
    });

    this.addRule('BankRegister', {
      entityType: 'BankRegister',
      classification: DataClassification.RESTRICTED,
      retentionDays: RetentionPeriod.SEVEN_YEARS,
      reason: 'Bank transaction audit trail',
      complianceStandard: ['SOX', 'IRS', 'Bank Secrecy Act']
    });

    // Business Expenses - Tax Compliance
    this.addRule('BusinessExpense', {
      entityType: 'BusinessExpense',
      classification: DataClassification.CONFIDENTIAL,
      retentionDays: RetentionPeriod.SEVEN_YEARS,
      reason: 'Tax deduction documentation and audit support',
      complianceStandard: ['IRS', 'Tax Code', 'GAAP']
    });

    // Adjustments - Audit Trail
    this.addRule('Adjustment', {
      entityType: 'Adjustment',
      classification: DataClassification.RESTRICTED,
      retentionDays: RetentionPeriod.PERMANENT,
      reason: 'Financial adjustment audit trail for compliance',
      complianceStandard: ['SOX', 'GAAP', 'Audit Standards']
    });
  }

  /**
   * Add or update a classification rule
   */
  public addRule(entityType: string, rule: ClassificationRule): void {
    this.classificationRules.set(entityType, rule);
  }

  /**
   * Automatically classify data when it's created
   */
  public classifyData(entityType: string, entityId: string, additionalContext?: any): DataClassificationMetadata {
    const rule = this.classificationRules.get(entityType);
    
    if (!rule) {
      // Default classification for unknown entities
      return this.createDefaultClassification(entityType, entityId);
    }

    const now = new Date();
    const expiresAt = rule.retentionDays === RetentionPeriod.PERMANENT 
      ? null 
      : new Date(now.getTime() + (rule.retentionDays * 24 * 60 * 60 * 1000));

    return {
      id: this.generateClassificationId(),
      entityType,
      entityId,
      classification: rule.classification,
      retentionDays: rule.retentionDays,
      classifiedAt: now,
      expiresAt,
      complianceReasons: rule.complianceStandard,
      autoClassified: true
    };
  }

  /**
   * Create default classification for unknown entity types
   */
  private createDefaultClassification(entityType: string, entityId: string): DataClassificationMetadata {
    const now = new Date();
    return {
      id: this.generateClassificationId(),
      entityType,
      entityId,
      classification: DataClassification.INTERNAL,
      retentionDays: RetentionPeriod.THREE_YEARS,
      classifiedAt: now,
      expiresAt: new Date(now.getTime() + (RetentionPeriod.THREE_YEARS * 24 * 60 * 60 * 1000)),
      complianceReasons: ['Default Policy'],
      autoClassified: true
    };
  }

  /**
   * Check if data should be archived or deleted based on retention policy
   */
  public checkRetentionStatus(metadata: DataClassificationMetadata): {
    action: 'retain' | 'archive' | 'delete';
    daysUntilExpiry: number;
    complianceNote: string;
  } {
    if (!metadata.expiresAt) {
      return {
        action: 'retain',
        daysUntilExpiry: -1,
        complianceNote: 'Permanent retention required by compliance standards'
      };
    }

    const now = new Date();
    const daysUntilExpiry = Math.ceil((metadata.expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

    if (daysUntilExpiry > 90) {
      return {
        action: 'retain',
        daysUntilExpiry,
        complianceNote: 'Within retention period'
      };
    } else if (daysUntilExpiry > 0) {
      return {
        action: 'archive',
        daysUntilExpiry,
        complianceNote: 'Approaching retention limit - prepare for archival'
      };
    } else {
      return {
        action: 'delete',
        daysUntilExpiry,
        complianceNote: 'Retention period expired - eligible for deletion'
      };
    }
  }

  /**
   * Get all entities approaching retention expiry
   */
  public getExpiringData(withinDays: number = 90): Promise<DataClassificationMetadata[]> {
    // This would typically query the database
    // Implementation depends on your database setup
    throw new Error('Database integration required - implement based on your DB choice');
  }

  /**
   * Generate unique classification ID
   */
  private generateClassificationId(): string {
    return `cls_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get classification rule for entity type
   */
  public getRule(entityType: string): ClassificationRule | undefined {
    return this.classificationRules.get(entityType);
  }

  /**
   * Get all classification rules
   */
  public getAllRules(): Map<string, ClassificationRule> {
    return new Map(this.classificationRules);
  }
}