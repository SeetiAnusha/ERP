import ReportExportLog from '../../models/accounting/ReportExportLog';
import { ReportExportOptions, ReportExportResult } from '../../types/reporting';
import fs from 'fs';
import path from 'path';

/**
 * Report Export Service
 * 
 * Handles report export to CSV, PDF, and JSON formats.
 * Generates unique reference numbers and logs all exports.
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.9, 8.10, 8.11, 8.12, 8.13
 */
class ReportExportService {
  private exportDir: string;

  constructor() {
    this.exportDir = path.join(process.cwd(), 'tmp', 'reports');
    // Ensure export directory exists
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }
  }

  /**
   * Generate unique reference number
   * Format: RPT-YYYY-NNNNNN
   */
  async generateRefNumber(): Promise<string> {
    const currentYear = new Date().getFullYear();

    // Get last reference number for current year
    const lastExport = await ReportExportLog.findOne({
      where: {
        referenceNumber: {
          $like: `RPT-${currentYear}-%`,
        } as any,
      },
      order: [['createdAt', 'DESC']],
    });

    let sequence = 1;
    if (lastExport) {
      const lastSequence = parseInt(lastExport.referenceNumber.split('-')[2]);
      sequence = lastSequence + 1;
    }

    // Format with zero-padding (6 digits)
    const sequenceStr = sequence.toString().padStart(6, '0');
    return `RPT-${currentYear}-${sequenceStr}`;
  }

  /**
   * Export report to CSV
   */
  async exportCSV(options: ReportExportOptions): Promise<ReportExportResult> {
    const referenceNumber = await this.generateRefNumber();
    const fileName = `${referenceNumber}.csv`;
    const filePath = path.join(this.exportDir, fileName);

    // Convert report data to CSV
    const csvContent = this.convertToCSV(options.reportData);

    // Write file
    fs.writeFileSync(filePath, csvContent, 'utf-8');
    const fileSize = fs.statSync(filePath).size;

    // Log export
    await this.logExport(referenceNumber, options, fileSize);

    // Schedule cleanup after 24 hours
    this.scheduleCleanup(filePath, 24 * 60 * 60 * 1000);

    return {
      referenceNumber,
      filePath,
      fileSize,
      format: 'CSV',
      exportedAt: new Date(),
    };
  }

  /**
   * Export report to PDF
   */
  async exportPDF(options: ReportExportOptions): Promise<ReportExportResult> {
    const referenceNumber = await this.generateRefNumber();
    const fileName = `${referenceNumber}.pdf`;
    const filePath = path.join(this.exportDir, fileName);

    // Generate PDF content
    // Note: In production, use PDFKit library for proper PDF generation
    const pdfContent = this.generatePDFContent(options, referenceNumber);

    // Write file (simplified - would use PDFKit in production)
    fs.writeFileSync(filePath, pdfContent, 'utf-8');
    const fileSize = fs.statSync(filePath).size;

    // Log export
    await this.logExport(referenceNumber, options, fileSize);

    // Schedule cleanup after 24 hours
    this.scheduleCleanup(filePath, 24 * 60 * 60 * 1000);

    return {
      referenceNumber,
      filePath,
      fileSize,
      format: 'PDF',
      exportedAt: new Date(),
    };
  }

  /**
   * Export report to JSON
   */
  async exportJSON(options: ReportExportOptions): Promise<ReportExportResult> {
    const referenceNumber = await this.generateRefNumber();
    const fileName = `${referenceNumber}.json`;
    const filePath = path.join(this.exportDir, fileName);

    // Create JSON with metadata
    const jsonData = {
      referenceNumber,
      exportedAt: new Date().toISOString(),
      exportedBy: options.userId,
      reportType: options.reportType,
      metadata: options.metadata,
      data: options.reportData,
    };

    // Write file
    fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2), 'utf-8');
    const fileSize = fs.statSync(filePath).size;

    // Log export
    await this.logExport(referenceNumber, options, fileSize);

    return {
      referenceNumber,
      filePath,
      fileSize,
      format: 'JSON',
      exportedAt: new Date(),
    };
  }

  /**
   * Convert data to CSV format
   */
  private convertToCSV(data: any): string {
    if (!data || typeof data !== 'object') {
      return '';
    }

    let csv = '';

    // Handle array of objects
    if (Array.isArray(data)) {
      if (data.length === 0) return '';

      // Headers
      const headers = Object.keys(data[0]);
      csv += headers.map(h => this.escapeCSV(h)).join(',') + '\n';

      // Rows
      for (const row of data) {
        csv += headers.map(h => this.escapeCSV(row[h])).join(',') + '\n';
      }
    } else {
      // Handle object (convert to key-value pairs)
      csv += 'Field,Value\n';
      for (const [key, value] of Object.entries(data)) {
        csv += `${this.escapeCSV(key)},${this.escapeCSV(value)}\n`;
      }
    }

    return csv;
  }

  /**
   * Escape special characters for CSV
   */
  private escapeCSV(value: any): string {
    if (value === null || value === undefined) return '';

    const str = String(value);

    // If contains comma, quote, or newline, wrap in quotes and escape quotes
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }

    return str;
  }

  /**
   * Generate PDF content
   * Note: Simplified version - use PDFKit in production
   */
  private generatePDFContent(options: ReportExportOptions, referenceNumber: string): string {
    const { metadata } = options;

    let content = `%PDF-1.4\n`;
    content += `% ${metadata.companyName || 'Company Name'}\n`;
    content += `% ${metadata.title}\n`;
    content += `% Reference: ${referenceNumber}\n`;

    if (metadata.dateRange) {
      content += `% Period: ${metadata.dateRange.start} to ${metadata.dateRange.end}\n`;
    } else if (metadata.asOfDate) {
      content += `% As of: ${metadata.asOfDate}\n`;
    }

    content += `% Generated: ${new Date().toISOString()}\n`;
    content += `\n`;
    content += JSON.stringify(options.reportData, null, 2);

    return content;
  }

  /**
   * Log export to database
   */
  private async logExport(
    referenceNumber: string,
    options: ReportExportOptions,
    fileSize: number
  ): Promise<void> {
    await ReportExportLog.create({
      referenceNumber,
      reportType: options.reportType,
      reportFormat: options.format,
      dateRangeStart: options.metadata.dateRange?.start,
      dateRangeEnd: options.metadata.dateRange?.end,
      asOfDate: options.metadata.asOfDate,
      filters: options.metadata.filters,
      exportedBy: options.userId,
      exportedAt: new Date(),
      fileSizeBytes: fileSize,
    });
  }

  /**
   * Schedule file cleanup
   */
  private scheduleCleanup(filePath: string, delayMs: number): void {
    setTimeout(() => {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`Cleaned up export file: ${filePath}`);
        }
      } catch (error) {
        console.error(`Failed to cleanup export file: ${filePath}`, error);
      }
    }, delayMs);
  }
}

export default new ReportExportService();
