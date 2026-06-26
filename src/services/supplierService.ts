import Supplier from '../models/Supplier';
import { BaseService } from '../core/BaseService';
import { NotFoundError, ValidationError } from '../core/AppError';

/**
 * SupplierService
 * Manages all supplier (vendor) operations.
 * Suppliers are the companies or individuals from whom the business purchases goods or services.
 */
// ✅ Convert to class-based service for pagination support
class SupplierService extends BaseService {

  /**
   * Returns all suppliers ordered by most recently created.
   * Used by: Supplier list page, Purchase form dropdowns.
   */
  async getAllSuppliers() {
    return await Supplier.findAll({ order: [['createdAt', 'DESC']] });
  }

  /**
   * Returns suppliers with pagination support.
   * Used when the supplier list is large and needs to be loaded page by page.
   */
  // ✅ NEW: Pagination support
  async getAllSuppliersWithPagination(options?: any) {
    return this.getAllWithPagination(Supplier, options);
  }

  /**
   * Finds a single supplier by their database ID.
   * Used when editing a supplier or pre-filling a form.
   */
  async getSupplierById(id: number) {
    return await Supplier.findByPk(id);
  }

  /**
   * Creates a new supplier record.
   * Called when the user submits the "Add Supplier" form.
   * Retries automatically on transient DB errors.
   */
  async createSupplier(data: any) {
    return this.executeWithRetry(async () => {
      const supplier= await Supplier.create(data);
      return supplier;
    });
  }

  /**
   * Updates an existing supplier's information (name, RNC, contact, etc.).
   * Throws NotFoundError if the supplier ID does not exist.
   */
  async updateSupplier(id: number, data: any) {
    return this.executeWithRetry(async () => {
      const supplier = await Supplier.findByPk(id);
      if (!supplier) throw new NotFoundError(`Supplier with ID ${id} not found`);
      return await supplier.update(data);
    });
  }

  /**
   * Permanently deletes a supplier from the database.
   * Throws NotFoundError if the supplier does not exist.
   * Note: Deleting a supplier with linked purchases may cause referential integrity issues.
   */
  async deleteSupplier(id: number) {
    const supplier = await Supplier.findByPk(id);
    if (!supplier) throw new NotFoundError(`Supplier with ID ${id} not found`);
    await supplier.destroy();
    return { message: 'Supplier deleted successfully' };
  }
}

const supplierService = new SupplierService();

export const getAllSuppliers = async () => {
  return supplierService.getAllSuppliers();
};

export const getSupplierById = async (id: number) => {
  return supplierService.getSupplierById(id);
};

export const createSupplier = async (data: any) => {
  return supplierService.createSupplier(data);
};

export const updateSupplier = async (id: number, data: any) => {
  return supplierService.updateSupplier(id, data);
};

export const deleteSupplier = async (id: number) => {
  return supplierService.deleteSupplier(id);
};

// ✅ NEW: Export pagination method
export const getAllSuppliersWithPagination = async (options?: any) => {
  return supplierService.getAllSuppliersWithPagination(options);
};
