import ProductPrice from '../models/ProductPrice';
import Product from '../models/Product';
import { Op, WhereOptions } from 'sequelize';

// Get all price history for a product
export const getPriceHistory = async (productId: number) => {
  return await ProductPrice.findAll({
    where: { productId },
    order: [['effectiveDate', 'DESC']],
  });
};

// Get current active price for a product (ONLY if date is exactly today)
export const getCurrentPrice = async (productId: number) => {
  const today = new Date();
  const todayString = today.toISOString().split('T')[0];
  
  // Get all prices and find the one that matches today exactly
  const allPrices = await ProductPrice.findAll({
    where: { productId },
  });
  
  for (const price of allPrices) {
    const priceDateString = new Date(price.effectiveDate).toISOString().split('T')[0];
    if (priceDateString === todayString) {
      return price;
    }
  }
  
  return null;
};

// Get price valid for a specific date
export const getPriceForDate = async (productId: number, date: Date) => {
  return await ProductPrice.findOne({
    where: {
      productId,
      effectiveDate: { [Op.lte]: date },
      [Op.or]: [
        { endDate: { [Op.is]: null } },
        { endDate: { [Op.gte]: date } }
      ],
      isActive: true,
    } as WhereOptions,
    order: [['effectiveDate', 'DESC']],
  });
};

// Create new price
export const createPrice = async (data: any) => {
  const { productId, salesPrice, effectiveDate } = data;
  
  // Normalize the date to YYYY-MM-DD format for comparison
  const normalizedDate = new Date(effectiveDate).toISOString().split('T')[0];
  
  // Check if a price already exists for this date
  const allPrices = await ProductPrice.findAll({
    where: { productId },
  });
  
  for (const price of allPrices) {
    const existingDate = new Date(price.effectiveDate).toISOString().split('T')[0];
    if (existingDate === normalizedDate) {
      throw new Error('A price already exists for this date. Please use a different date or edit the existing price.');
    }
  }
  
  const newEffectiveDate = new Date(effectiveDate);
  newEffectiveDate.setHours(0, 0, 0, 0);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Get all existing prices for this product
  const existingPrices = await ProductPrice.findAll({
    where: { productId },
    order: [['effectiveDate', 'DESC']],
  });

  // Set end date for all previous prices
  for (const price of existingPrices) {
    const priceEffectiveDate = new Date(price.effectiveDate);
    priceEffectiveDate.setHours(0, 0, 0, 0);
    
    if (priceEffectiveDate < newEffectiveDate) {
      // This price is before the new one, set its end date
      const newEndDate = new Date(effectiveDate);
      newEndDate.setDate(newEndDate.getDate() - 1);
      await price.update({ endDate: newEndDate, isActive: false });
    }
  }

  // Create new price (initially inactive)
  const newPrice = await ProductPrice.create({
    productId,
    salesPrice,
    effectiveDate,
    endDate: undefined,
    isActive: false,
  });

  // Now determine which price should be active (ONLY if date is exactly today)
  const todayString = today.toISOString().split('T')[0];
  const allPricesAfterCreate = await ProductPrice.findAll({
    where: { productId },
    order: [['effectiveDate', 'DESC']],
  });
  
  // Find the price that matches today's date exactly
  let currentActivePrice: ProductPrice | null = null;
  for (const price of allPricesAfterCreate) {
    const priceDateString = new Date(price.effectiveDate).toISOString().split('T')[0];
    if (priceDateString === todayString) {
      currentActivePrice = price;
      break;
    }
  }
  
  // Set only today's price as active (if it exists)
  for (const price of allPricesAfterCreate) {
    const shouldBeActive = currentActivePrice && price.id === currentActivePrice.id;
    if (price.isActive !== shouldBeActive) {
      await price.update({ isActive: !!shouldBeActive });
    }
  }

  // Update product's salesPrice with the current active price
  if (currentActivePrice) {
    await Product.update(
      { salesPrice: currentActivePrice.salesPrice },
      { where: { id: productId } }
    );
  } else {
    // No price for today, set salesPrice to 0 or keep the last known price
    // For better UX, let's keep the most recent price even if not active
    const mostRecentPrice = allPricesAfterCreate[0]; // Already sorted DESC
    if (mostRecentPrice) {
      await Product.update(
        { salesPrice: mostRecentPrice.salesPrice },
        { where: { id: productId } }
      );
    }
  }

  return newPrice;
};

// Update price
export const updatePrice = async (id: number, data: any) => {
  const price = await ProductPrice.findByPk(id);
  if (!price) throw new Error('Price not found');
  
  const { salesPrice, effectiveDate } = data;
  const productId = price.productId;
  
  // If changing the date, check if another price exists for that date
  if (effectiveDate) {
    const normalizedNewDate = new Date(effectiveDate).toISOString().split('T')[0];
    const normalizedOldDate = new Date(price.effectiveDate).toISOString().split('T')[0];
    
    if (normalizedNewDate !== normalizedOldDate) {
      // Date is changing, check for duplicates
      const allPrices = await ProductPrice.findAll({
        where: { productId },
      });
      
      for (const p of allPrices) {
        if (p.id !== id) {
          const existingDate = new Date(p.effectiveDate).toISOString().split('T')[0];
          if (existingDate === normalizedNewDate) {
            throw new Error('A price already exists for this date. Please use a different date.');
          }
        }
      }
    }
  }
  
  // Update the price
  await price.update({
    salesPrice: salesPrice !== undefined ? salesPrice : price.salesPrice,
    effectiveDate: effectiveDate !== undefined ? effectiveDate : price.effectiveDate,
  });
  
  // Recalculate active status for all prices of this product
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayString = today.toISOString().split('T')[0];
  
  const allPricesForProduct = await ProductPrice.findAll({
    where: { productId },
    order: [['effectiveDate', 'DESC']],
  });
  
  // Find the price that matches today's date exactly
  let currentActivePrice: ProductPrice | null = null;
  for (const p of allPricesForProduct) {
    const pDateString = new Date(p.effectiveDate).toISOString().split('T')[0];
    if (pDateString === todayString) {
      currentActivePrice = p;
      break;
    }
  }
  
  // Set only today's price as active (if it exists)
  for (const p of allPricesForProduct) {
    const shouldBeActive = currentActivePrice && p.id === currentActivePrice.id;
    if (p.isActive !== shouldBeActive) {
      await p.update({ isActive: !!shouldBeActive });
    }
  }
  
  // Sync product price with current active price
  if (currentActivePrice) {
    await Product.update(
      { salesPrice: currentActivePrice.salesPrice },
      { where: { id: productId } }
    );
  } else {
    // No price for today, set salesPrice to the most recent price
    const allPrices = await ProductPrice.findAll({
      where: { productId },
      order: [['effectiveDate', 'DESC']],
    });
    if (allPrices.length > 0) {
      await Product.update(
        { salesPrice: allPrices[0].salesPrice },
        { where: { id: productId } }
      );
    }
  }
  
  return price;
};

// Delete price
export const deletePrice = async (id: number) => {
  const price = await ProductPrice.findByPk(id);
  if (!price) throw new Error('Price not found');
  
  const productId = price.productId;
  await price.destroy();
  
  // After deletion, update the product's salesPrice to the current active price
  const currentPrice = await getCurrentPrice(productId);
  if (currentPrice) {
    await Product.update(
      { salesPrice: currentPrice.salesPrice },
      { where: { id: productId } }
    );
  } else {
    // No active price found, set to 0 or null
    await Product.update(
      { salesPrice: 0 },
      { where: { id: productId } }
    );
  }
  
  return { message: 'Price deleted successfully' };
};

// Sync product salesPrice with current active price (ONLY if date is exactly today)
export const syncProductPrice = async (productId: number) => {
  const today = new Date();
  const todayString = today.toISOString().split('T')[0];
  
  // Get all prices for this product
  const allPrices = await ProductPrice.findAll({
    where: { productId },
    order: [['effectiveDate', 'DESC']],
  });
  
  // Find the price that matches today's date exactly
  let currentActivePrice: ProductPrice | null = null;
  for (const price of allPrices) {
    const priceDateString = new Date(price.effectiveDate).toISOString().split('T')[0];
    if (priceDateString === todayString) {
      currentActivePrice = price;
      break;
    }
  }
  
  // Set only today's price as active (if it exists)
  for (const price of allPrices) {
    const shouldBeActive = currentActivePrice && price.id === currentActivePrice.id;
    if (price.isActive !== shouldBeActive) {
      await price.update({ isActive: !!shouldBeActive });
    }
  }
  
  // Update product's salesPrice
  if (currentActivePrice) {
    await Product.update(
      { salesPrice: currentActivePrice.salesPrice },
      { where: { id: productId } }
    );
    return currentActivePrice.salesPrice;
  } else {
    // No price for today, use the most recent price
    if (allPrices.length > 0) {
      await Product.update(
        { salesPrice: allPrices[0].salesPrice },
        { where: { id: productId } }
      );
      return allPrices[0].salesPrice;
    }
  }
  return null;
};

// Update all prices to set correct active status based on current date (ONLY today's date)
export const updatePriceActiveStatus = async () => {
  const today = new Date();
  const todayString = today.toISOString().split('T')[0];
  
  // Get all products
  const products = await Product.findAll();
  
  for (const product of products) {
    // Get all prices for this product
    const allPricesForProduct = await ProductPrice.findAll({
      where: { productId: product.id },
      order: [['effectiveDate', 'DESC']],
    });
    
    // Find the price that matches today's date exactly
    let currentActivePrice: ProductPrice | null = null;
    for (const price of allPricesForProduct) {
      const priceDateString = new Date(price.effectiveDate).toISOString().split('T')[0];
      if (priceDateString === todayString) {
        currentActivePrice = price;
        break;
      }
    }
    
    // Update all prices: only today's price should be active
    for (const price of allPricesForProduct) {
      const shouldBeActive = currentActivePrice && price.id === currentActivePrice.id;
      
      if (price.isActive !== shouldBeActive) {
        await price.update({ isActive: !!shouldBeActive });
      }
    }
    
    // Update product's salesPrice with today's active price
    if (currentActivePrice) {
      await Product.update(
        { salesPrice: currentActivePrice.salesPrice },
        { where: { id: product.id } }
      );
    }
  }
  
  return { message: 'Price active status updated successfully' };
};
