import { Request, Response } from 'express';
import inventoryService from '../services/inventoryService';

/**
 * Inventory Controller
 * Handles inventory-related requests
 */
class InventoryController {
  /**
   * Get inventory as of a specific date
   * Query params:
   * - asOfDate: Date to get inventory for (required)
   * - page: Page number (optional, default: 1)
   * - limit: Items per page (optional, default: 50)
   * - search: Search term (optional)
   */
  async getInventoryAsOfDate(req: Request, res: Response) {
    try {
      const { asOfDate, page = '1', limit = '50', search = '' } = req.query;

      // Validate asOfDate parameter
      if (!asOfDate || typeof asOfDate !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'asOfDate parameter is required'
        });
      }

      // Validate date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(asOfDate)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format. Use YYYY-MM-DD'
        });
      }

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);

      const result = await inventoryService.getInventoryWithPagination(
        asOfDate,
        pageNum,
        limitNum,
        search as string
      );

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination
      });
    } catch (error: any) {
      console.error('Error in getInventoryAsOfDate:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch inventory data'
      });
    }
  }
}

export default new InventoryController();
