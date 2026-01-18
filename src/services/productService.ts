import Product from '../models/Product';

export const getAllProducts = async () => {
  return await Product.findAll({ order: [['createdAt', 'DESC']] });
};

export const getProductById = async (id: number) => {
  return await Product.findByPk(id);
};

export const createProduct = async (data: any) => {
  return await Product.create(data);
};

export const updateProduct = async (id: number, data: any) => {
  const product = await Product.findByPk(id);
  if (!product) throw new Error('Product not found');
  return await product.update(data);
};

export const deleteProduct = async (id: number) => {
  const product = await Product.findByPk(id);
  if (!product) throw new Error('Product not found');
  await product.destroy();
  return { message: 'Product deleted successfully' };
};
