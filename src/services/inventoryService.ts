import { Op } from 'sequelize';
import Product from '../models/Product';
import Purchase from '../models/Purchase';
import PurchaseItem from '../models/PurchaseItem';
import Sale from '../models/Sale';
import SaleItem from '../models/SaleItem';
import sequelize from '../config/database';

/**
 * Inventory Service
 * Calculates inventory balances as of a specific date
 */
class InventoryService {
  /**
   * Get inventory snapshot as of a specific date
   * This calculates the inventory by:
   * 1. Getting all products that existed on or before the date
   * 2. Calculating purchases up to that date
   * 3. Subtracting sales up to that date
   * 4. Computing the weighted average cost
   */
  async getInventoryAsOfDate(asOfDate: string) {
    try {
      const endOfDay = new Date(asOfDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Get all products that were created on or before the selected date
      const products = await Product.findAll({
        where: {
          createdAt: {
            [Op.lte]: endOfDay
          },
          status: 'ACTIVE'
        },
        order: [['code', 'ASC']]
      });

      // Calculate inventory for each product
      const inventoryData = await Promise.all(
        products.map(async (product) => {
          // Get all purchase items for this product up to the date
          const purchaseItems = await PurchaseItem.findAll({
            include: [{
              model: Purchase,
              as: 'purchase',
              where: {
                date: {
                  [Op.lte]: endOfDay
                },
                status: {
                  [Op.notIn]: ['CANCELLED', 'DELETED']
                }
              },
              required: true
            }],
            where: {
              productId: product.id
            }
          });

          // Get all sale items for this product up to the date
          const saleItems = await SaleItem.findAll({
            include: [{
              model: Sale,
              as: 'sale',
              where: {
                date: {
                  [Op.lte]: endOfDay
                },
                status: {
                  [Op.notIn]: ['CANCELLED', 'DELETED']
                }
              },
              required: true
            }],
            where: {
              productId: product.id
            }
          });

          // Calculate total purchases
          let totalPurchaseQuantity = 0;
          let totalPurchaseValue = 0;

          purchaseItems.forEach(item => {
            const quantity = Number(item.quantity) || 0;
            const unitCost = Number(item.unitCost) || 0;
            totalPurchaseQuantity += quantity;
            totalPurchaseValue += quantity * unitCost;
          });

          // Calculate total sales
          let totalSaleQuantity = 0;

          saleItems.forEach(item => {
            const quantity = Number(item.quantity) || 0;
            totalSaleQuantity += quantity;
          });

          // Calculate current inventory
          const currentQuantity = totalPurchaseQuantity - totalSaleQuantity;
          
          // ✅ FIX: Use the actual product unit cost from database (which has running weighted average)
          // This matches the Products table which is updated with each purchase
          const actualUnitCost = Number(product.unitCost) || 0;
          
          // Calculate amount (Quantity × Unit Cost from product table)
          const amount = currentQuantity * actualUnitCost;

          // Only return products that have inventory on this date
          // OR products that had transactions on or before this date
          if (currentQuantity > 0 || purchaseItems.length > 0 || saleItems.length > 0) {
            return {
              id: product.id,
              code: product.code,
              name: product.name,
              description: product.description || '',
              unit: product.unit,
              quantity: currentQuantity,
              unitCost: actualUnitCost,  // ✅ Use actual product unit cost
              amount: amount,
              createdAt: product.createdAt
            };
          }

          return null;
        })
      );

      // Filter out null values (products with no inventory)
      const filteredInventory = inventoryData.filter(item => item !== null);

      return filteredInventory;
    } catch (error: any) {
      console.error('Error getting inventory as of date:', error);
      throw error;
    }
  }

  /**
   * Get inventory with pagination and search
   */
  async getInventoryWithPagination(
    asOfDate: string,
    page: number = 1,
    limit: number = 50,
    search: string = ''
  ) {
    try {
      // Get all inventory data
      const allInventory = await this.getInventoryAsOfDate(asOfDate);

      // Apply search filter
      let filteredInventory = allInventory;
      if (search && search.trim() !== '') {
        const searchLower = search.toLowerCase();
        filteredInventory = allInventory.filter(item => 
          item.code.toLowerCase().includes(searchLower) ||
          item.name.toLowerCase().includes(searchLower) ||
          (item.description && item.description.toLowerCase().includes(searchLower))
        );
      }

      // Calculate pagination
      const total = filteredInventory.length;
      const totalPages = Math.ceil(total / limit);
      const offset = (page - 1) * limit;
      const paginatedData = filteredInventory.slice(offset, offset + limit);

      return {
        data: paginatedData,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
          from: total > 0 ? offset + 1 : 0,
          to: Math.min(offset + limit, total)
        }
      };
    } catch (error: any) {
      console.error('Error getting inventory with pagination:', error);
      throw error;
    }
  }
}

export default new InventoryService();
