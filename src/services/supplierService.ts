import Supplier from '../models/Supplier';
import { BaseService } from '../core/BaseService';

// ✅ Convert to class-based service for pagination support
class SupplierService extends BaseService {
  async getAllSuppliers() {
    return await Supplier.findAll({ order: [['createdAt', 'DESC']] });
  }

  // ✅ NEW: Pagination support
  async getAllSuppliersWithPagination(options?: any) {
    return this.getAllWithPagination(Supplier, options);
  }
}

const supplierService = new SupplierService();

export const getAllSuppliers = async () => {
  return supplierService.getAllSuppliers();
};

export const getSupplierById = async (id: number) => {
  return await Supplier.findByPk(id);
};

export const createSupplier = async (data: any) => {
  return await Supplier.create(data);
};

export const updateSupplier = async (id: number, data: any) => {
  const supplier = await Supplier.findByPk(id);
  if (!supplier) throw new Error('Supplier not found');
  return await supplier.update(data);
};

export const deleteSupplier = async (id: number) => {
  const supplier = await Supplier.findByPk(id);
  if (!supplier) throw new Error('Supplier not found');
  await supplier.destroy();
  return { message: 'Supplier deleted successfully' };
};

// ✅ NEW: Export pagination method
export const getAllSuppliersWithPagination = async (options?: any) => {
  return supplierService.getAllSuppliersWithPagination(options);
};
