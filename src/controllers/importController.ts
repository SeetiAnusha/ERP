import { Request, Response } from 'express';
import ExcelImportService from '../services/ExcelImportService';

// Extend Express Request to include multer file
interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

/**
 * Import Products from Excel file
 * POST /api/import/products
 */
export const importProducts = async (req: MulterRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Please upload an Excel file.'
      });
    }

    // Validate file type
    const allowedMimeTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Please upload an Excel file (.xls or .xlsx)'
      });
    }

    const result = await ExcelImportService.importProducts(req.file.buffer);
    
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    console.error('Error importing products:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to import products: ' + error.message
    });
  }
};

/**
 * Import Suppliers from Excel file
 * POST /api/import/suppliers
 */
export const importSuppliers = async (req: MulterRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Please upload an Excel file.'
      });
    }

    const allowedMimeTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Please upload an Excel file (.xls or .xlsx)'
      });
    }

    const result = await ExcelImportService.importSuppliers(req.file.buffer);
    
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    console.error('Error importing suppliers:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to import suppliers: ' + error.message
    });
  }
};

/**
 * Import Clients from Excel file
 * POST /api/import/clients
 */
export const importClients = async (req: MulterRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Please upload an Excel file.'
      });
    }

    const allowedMimeTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Please upload an Excel file (.xls or .xlsx)'
      });
    }

    const result = await ExcelImportService.importClients(req.file.buffer);
    
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    console.error('Error importing clients:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to import clients: ' + error.message
    });
  }
};
