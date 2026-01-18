import Supplier from '../models/Supplier';

export const getAllSuppliers = async () => {
  return await Supplier.findAll({ order: [['createdAt', 'DESC']] });
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
