import Supplier from '../models/Supplier';
import { BaseService } from '../core/BaseService';
import { NotFoundError, ValidationError } from '../core/AppError';

// ✅ Convert to class-based service for pagination support
class SupplierService extends BaseService {
  async getAllSuppliers() {
    return await Supplier.findAll({ order: [['createdAt', 'DESC']] });
  }

  // ✅ NEW: Pagination support
  async getAllSuppliersWithPagination(options?: any) {
    return this.getAllWithPagination(Supplier, options);
  }

  async getSupplierById(id: number) {
    return await Supplier.findByPk(id);
  }

  async createSupplier(data: any) {
    return this.executeWithRetry(async () => {
      const supplier= await Supplier.create(data);
      return supplier;
    });
  }

  async updateSupplier(id: number, data: any) {
    return this.executeWithRetry(async () => {
      const supplier = await Supplier.findByPk(id);
      if (!supplier) throw new NotFoundError(`Supplier with ID ${id} not found`);
      return await supplier.update(data);
    });
  }

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
