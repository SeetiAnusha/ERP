/**
 * Data Classification Controller
 * Provides API endpoints for data classification management and compliance monitoring
 */

import { Request, Response } from 'express';
import { dataClassificationService } from '../services/SafeDataClassificationService';
import DataClassificationMetadata from '../models/DataClassificationMetadata';
import { Op } from 'sequelize';

/**
 * Get classification dashboard data
 */
export const getDashboard = async (req: Request, res: Response) => {
  try {
    // Get classification summary by type
    const classificationSummary = await DataClassificationMetadata.findAll({
      attributes: [
        'classification',
        [DataClassificationMetadata.sequelize!.fn('COUNT', '*'), 'count']
      ],
      where: { isActive: true },
      group: ['classification'],
      raw: true
    });

    // Get entity type summary
    const entitySummary = await DataClassificationMetadata.findAll({
      attributes: [
        'entityType',
        'classification',
        [DataClassificationMetadata.sequelize!.fn('COUNT', '*'), 'count']
      ],
      where: { isActive: true },
      group: ['entityType', 'classification'],
      raw: true
    });

    // Get retention summary
    const retentionSummary = await DataClassificationMetadata.findAll({
      attributes: [
        'retentionDays',
        [DataClassificationMetadata.sequelize!.fn('COUNT', '*'), 'count']
      ],
      where: { isActive: true },
      group: ['retentionDays'],
      raw: true
    });

    // Get expiring data (next 90 days)
    const expiringData = await dataClassificationService.getExpiringEntities(90);

    // Get recent classifications
    const recentClassifications = await DataClassificationMetadata.findAll({
      where: { isActive: true },
      order: [['classifiedAt', 'DESC']],
      limit: 10
    });

    res.json({
      success: true,
      data: {
        classificationSummary,
        entitySummary,
        retentionSummary,
        expiringData: expiringData.length,
        recentClassifications,
        systemStatus: {
          enabled: dataClassificationService.isEnabled(),
          totalClassified: classificationSummary.reduce((sum: number, item: any) => sum + parseInt(item.count), 0)
        }
      }
    });
  } catch (error) {
    console.error('Dashboard data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get all classifications with pagination and filtering
 */
export const getClassifications = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 50,
      entityType,
      classification,
      search
    } = req.query;

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    
    // Build where clause
    const whereClause: any = { isActive: true };
    
    if (entityType) {
      whereClause.entityType = entityType;
    }
    
    if (classification) {
      whereClause.classification = classification;
    }
    
    if (search) {
      whereClause[Op.or] = [
        { entityType: { [Op.iLike]: `%${search}%` } },
        { entityId: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const { rows: classifications, count } = await DataClassificationMetadata.findAndCountAll({
      where: whereClause,
      order: [['classifiedAt', 'DESC']],
      limit: parseInt(limit as string),
      offset
    });

    res.json({
      success: true,
      data: {
        classifications,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: count,
          pages: Math.ceil(count / parseInt(limit as string))
        }
      }
    });
  } catch (error) {
    console.error('Get classifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch classifications',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get expiring data for compliance monitoring
 */
export const getExpiringData = async (req: Request, res: Response) => {
  try {
    const { withinDays = 90 } = req.query;
    
    const expiringData = await dataClassificationService.getExpiringEntities(
      parseInt(withinDays as string)
    );

    // Group by urgency
    const now = new Date();
    const urgent = expiringData.filter(item => {
      if (!item.expiresAt) return false;
      const daysLeft = Math.ceil((new Date(item.expiresAt).getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      return daysLeft <= 30;
    });

    const warning = expiringData.filter(item => {
      if (!item.expiresAt) return false;
      const daysLeft = Math.ceil((new Date(item.expiresAt).getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      return daysLeft > 30 && daysLeft <= 90;
    });

    res.json({
      success: true,
      data: {
        total: expiringData.length,
        urgent: urgent.length,
        warning: warning.length,
        urgentItems: urgent,
        warningItems: warning,
        allItems: expiringData
      }
    });
  } catch (error) {
    console.error('Get expiring data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expiring data',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Manually classify a specific entity
 */
export const classifyEntity = async (req: Request, res: Response) => {
  try {
    const { entityType, entityId } = req.body;

    if (!entityType || !entityId) {
      return res.status(400).json({
        success: false,
        message: 'entityType and entityId are required'
      });
    }

    await dataClassificationService.safeClassifyData(entityType, entityId, {
      manual: true,
      triggeredBy: (req as any).user?.userId || 'system',
      timestamp: new Date()
    });

    // Get the created classification
    const classification = await dataClassificationService.getClassification(entityType, entityId);

    res.json({
      success: true,
      message: 'Entity classified successfully',
      data: classification
    });
  } catch (error) {
    console.error('Manual classification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to classify entity',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Update classification for an entity
 */
export const updateClassification = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { classification, retentionDays } = req.body;

    const metadata = await DataClassificationMetadata.findByPk(id);
    
    if (!metadata) {
      return res.status(404).json({
        success: false,
        message: 'Classification not found'
      });
    }

    // Update classification
    if (classification) {
      metadata.classification = classification;
    }
    
    if (retentionDays !== undefined) {
      metadata.retentionDays = retentionDays;
      
      // Recalculate expiry date
      if (retentionDays === -1) {
        metadata.expiresAt = null; // Permanent
      } else {
        metadata.expiresAt = new Date(Date.now() + (retentionDays * 24 * 60 * 60 * 1000));
      }
    }

    await metadata.save();

    res.json({
      success: true,
      message: 'Classification updated successfully',
      data: metadata
    });
  } catch (error) {
    console.error('Update classification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update classification',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get compliance report
 */
export const getComplianceReport = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, format = 'json' } = req.query;

    // Build date filter
    const dateFilter: any = {};
    if (startDate) {
      dateFilter[Op.gte] = new Date(startDate as string);
    }
    if (endDate) {
      dateFilter[Op.lte] = new Date(endDate as string);
    }

    const whereClause: any = { isActive: true };
    if (Object.keys(dateFilter).length > 0) {
      whereClause.classifiedAt = dateFilter;
    }

    // Get compliance data
    const complianceData = await DataClassificationMetadata.findAll({
      where: whereClause,
      order: [['classifiedAt', 'DESC']]
    });

    // Generate compliance summary
    const summary = {
      totalRecords: complianceData.length,
      byClassification: {} as Record<string, number>,
      byEntityType: {} as Record<string, number>,
      byRetention: {} as Record<string, number>,
      complianceStandards: {} as Record<string, number>
    };

    complianceData.forEach(item => {
      // By classification
      summary.byClassification[item.classification] = 
        (summary.byClassification[item.classification] || 0) + 1;

      // By entity type
      summary.byEntityType[item.entityType] = 
        (summary.byEntityType[item.entityType] || 0) + 1;

      // By retention
      const retentionKey = item.retentionDays === -1 ? 'Permanent' : `${item.retentionDays} days`;
      summary.byRetention[retentionKey] = 
        (summary.byRetention[retentionKey] || 0) + 1;

      // By compliance standards
      try {
        const standards = JSON.parse(item.complianceReasons);
        standards.forEach((standard: string) => {
          summary.complianceStandards[standard] = 
            (summary.complianceStandards[standard] || 0) + 1;
        });
      } catch (e) {
        // Handle non-JSON compliance reasons
      }
    });

    if (format === 'csv') {
      // Generate CSV format
      const csv = generateComplianceCSV(complianceData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=compliance-report.csv');
      return res.send(csv);
    }

    res.json({
      success: true,
      data: {
        summary,
        details: complianceData,
        generatedAt: new Date(),
        period: {
          startDate: startDate || 'All time',
          endDate: endDate || 'Present'
        }
      }
    });
  } catch (error) {
    console.error('Compliance report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate compliance report',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * System control endpoints
 */
export const enableSystem = async (req: Request, res: Response) => {
  try {
    dataClassificationService.enable();
    res.json({
      success: true,
      message: 'Data classification system enabled',
      status: dataClassificationService.isEnabled()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to enable system',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const disableSystem = async (req: Request, res: Response) => {
  try {
    dataClassificationService.disable();
    res.json({
      success: true,
      message: 'Data classification system disabled',
      status: dataClassificationService.isEnabled()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to disable system',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const getSystemStatus = async (req: Request, res: Response) => {
  try {
    const totalClassifications = await DataClassificationMetadata.count({
      where: { isActive: true }
    });

    res.json({
      success: true,
      data: {
        enabled: dataClassificationService.isEnabled(),
        totalClassifications,
        version: '1.0.0',
        lastUpdated: new Date()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get system status',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Helper function to generate CSV report
 */
function generateComplianceCSV(data: any[]): string {
  const headers = [
    'ID', 'Entity Type', 'Entity ID', 'Classification', 
    'Retention Days', 'Classified At', 'Expires At', 
    'Compliance Standards', 'Auto Classified'
  ];

  const rows = data.map(item => [
    item.id,
    item.entityType,
    item.entityId,
    item.classification,
    item.retentionDays === -1 ? 'Permanent' : item.retentionDays,
    item.classifiedAt.toISOString(),
    item.expiresAt ? item.expiresAt.toISOString() : 'Never',
    item.complianceReasons,
    item.autoClassified ? 'Yes' : 'No'
  ]);

  return [headers, ...rows]
    .map(row => row.map(field => `"${field}"`).join(','))
    .join('\n');
}