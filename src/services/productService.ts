import Product from '../models/Product';
import { BaseService } from '../core/BaseService';

/**
 * ProductService
 * Manages all product-related operations in the ERP system.
 * Products are the items bought and sold by the business (inventory items).
 */
class ProductService extends BaseService {
  
  /**
   * Retrieves all products with optional pagination, search, and date filtering.
   * Used by: Product list page, dropdowns in Purchase/Sale forms, Inventory page.
   * Returns: paginated list of products with total count.
   */
  async getAllProducts(options: any = {}): Promise<any> {
    return this.executeWithRetry(async () => {
      // Delegates to BaseService pagination helper.
      // Searches across code, name, and description fields.
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

  /**
   * Finds a single product by its database ID.
   * Used when editing a product or loading product details.
   */
  async getProductById(id: number) {
    return await Product.findByPk(id);
  }

  /**
   * Creates a new product record in the database.
   * Called when the user submits the "Add Product" form.
   */
  async createProduct(data: any) {
    return await Product.create(data);
  }

  /**
   * Updates an existing product's details (name, price, stock, etc.).
   * Throws an error if the product does not exist.
   */
  async updateProduct(id: number, data: any) {
    const product = await Product.findByPk(id);
    if (!product) throw new Error('Product not found');
    return await product.update(data);
  }

  /**
   * Permanently deletes a product from the database.
   * Throws an error if the product does not exist.
   * Note: Only delete products that have no purchase/sale history.
   */
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
