import Product from '../models/Product';
import { BaseService } from '../core/BaseService';

class ProductService extends BaseService {
  
  async getAllProducts(options: any = {}): Promise<any> {
    return this.executeWithRetry(async () => {
      // Use generic pagination from BaseService
      const result = await this.getAllWithPagination(
        Product,
        {
          ...options,
          searchFields: ['code', 'name', 'description'],
          dateField: 'createdAt'
        }
      );
      return result;
    });
  }

  async getProductById(id: number) {
    return await Product.findByPk(id);
  }

  async createProduct(data: any) {
    return await Product.create(data);
  }

  async updateProduct(id: number, data: any) {
    const product = await Product.findByPk(id);
    if (!product) throw new Error('Product not found');
    return await product.update(data);
  }

  async deleteProduct(id: number) {
    const product = await Product.findByPk(id);
    if (!product) throw new Error('Product not found');
    await product.destroy();
    return { message: 'Product deleted successfully' };
  }
}

const productService = new ProductService();

export const getAllProducts = (options?: any) => productService.getAllProducts(options);
export const getAllProductsWithPagination = (options?: any) => productService.getAllProducts(options);
export const getProductById = (id: number) => productService.getProductById(id);
export const createProduct = (data: any) => productService.createProduct(data);
export const updateProduct = (id: number, data: any) => productService.updateProduct(id, data);
export const deleteProduct = (id: number) => productService.deleteProduct(id);
