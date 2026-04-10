import { Request, Response, NextFunction } from 'express';
import ReportExportService from '../../services/reporting/ReportExportService';
import { ReportExportOptions } from '../../types/reporting';
import { getUserId } from '../../middleware/rbac';
import { ReportValidationError } from '../../core/AppError';
import fs from 'fs';

/**
 * Report Export Controller
 * 
 * Handles HTTP requests for report export to CSV, PDF, and JSON formats.
 * Requirements: 8.1-8.13
 */

/**
 * Export report
 * POST /api/reports/export
 */
export async function exportReport(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { reportType, reportData, format, metadata } = req.body;

    // Validate required fields
    if (!reportType || !reportData || !format) {
      throw new ReportValidationError(
        'Report type, data, and format are required',
        { reportType, hasData: !!reportData, format }
      );
    }

    // Validate format
    if (!['CSV', 'PDF', 'JSON'].includes(format)) {
      throw new ReportValidationError(
        'Format must be CSV, PDF, or JSON',
        { providedFormat: format }
      );
    }

    const userId = getUserId(req);

    const options: ReportExportOptions = {
      reportType,
      reportData,
      format,
      metadata: metadata || {},
      userId,
    };

    // Export report
    let result;
    switch (format) {
      case 'CSV':
        result = await ReportExportService.exportCSV(options);
        break;
      case 'PDF':
        result = await ReportExportService.exportPDF(options);
        break;
      case 'JSON':
        result = await ReportExportService.exportJSON(options);
        break;
    }

    // Read file and send as download
    if (!result) {
      throw new Error('Export failed - no result returned');
    }
    
    const fileContent = fs.readFileSync(result.filePath);
    const fileName = `${result.referenceNumber}.${format.toLowerCase()}`;

    res.setHeader('Content-Type', getContentType(format));
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('X-Reference-Number', result.referenceNumber);
    res.send(fileContent);
  } catch (error) {
    next(error);
  }
}

/**
 * Get content type for format
 */
function getContentType(format: string): string {
  switch (format) {
    case 'CSV':
      return 'text/csv';
    case 'PDF':
      return 'application/pdf';
    case 'JSON':
      return 'application/json';
    default:
      return 'application/octet-stream';
  }
}
