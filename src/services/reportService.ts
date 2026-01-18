import FixedAsset from '../models/FixedAsset';
import Investment from '../models/Investment';
import PrepaidExpense from '../models/PrepaidExpense';
import Purchase from '../models/Purchase';
import Sale from '../models/Sale';
import PurchaseItem from '../models/PurchaseItem';
import SaleItem from '../models/SaleItem';
import Product from '../models/Product';
import { Op } from 'sequelize';

// PPE Tracking Report
export const getPPETrackingReport = async (filters?: { startDate?: string; endDate?: string; category?: string }) => {
  const whereClause: any = {};
  
  if (filters?.category) {
    whereClause.category = filters.category;
  }
  
  const assets = await FixedAsset.findAll({
    where: whereClause,
    order: [['acquisitionDate', 'DESC']],
  });
  
  const report = assets.map(asset => {
    const acquisitionDate = new Date(asset.acquisitionDate);
    const today = new Date();
    const monthsElapsed = Math.floor((today.getTime() - acquisitionDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
    
    // Calculate depreciation
    let monthlyDepreciation = 0;
    let accumulatedDepreciation = Number(asset.accumulatedDepreciation);
    let currentBookValue = Number(asset.bookValue);
    
    if (asset.depreciationMethod === 'Straight Line') {
      const depreciableAmount = Number(asset.acquisitionCost) - Number(asset.residualValue);
      const totalMonths = asset.usefulLife * 12;
      monthlyDepreciation = depreciableAmount / totalMonths;
      
      // Calculate accumulated depreciation
      const calculatedAccumulated = Math.min(monthlyDepreciation * monthsElapsed, depreciableAmount);
      accumulatedDepreciation = calculatedAccumulated;
      currentBookValue = Number(asset.acquisitionCost) - accumulatedDepreciation;
    }
    
    const remainingLife = asset.usefulLife - (monthsElapsed / 12);
    const depreciationPercent = (accumulatedDepreciation / Number(asset.acquisitionCost)) * 100;
    
    return {
      id: asset.id,
      code: asset.code,
      name: asset.name,
      category: asset.category,
      acquisitionDate: asset.acquisitionDate,
      acquisitionCost: Number(asset.acquisitionCost),
      usefulLife: asset.usefulLife,
      depreciationMethod: asset.depreciationMethod,
      residualValue: Number(asset.residualValue),
      monthlyDepreciation,
      accumulatedDepreciation,
      currentBookValue,
      remainingLife: Math.max(0, remainingLife),
      depreciationPercent,
      status: asset.status,
      location: asset.location,
      serialNumber: asset.serialNumber,
    };
  });
  
  // Calculate totals
  const totals = {
    totalAcquisitionCost: report.reduce((sum, item) => sum + item.acquisitionCost, 0),
    totalAccumulatedDepreciation: report.reduce((sum, item) => sum + item.accumulatedDepreciation, 0),
    totalCurrentBookValue: report.reduce((sum, item) => sum + item.currentBookValue, 0),
    totalMonthlyDepreciation: report.reduce((sum, item) => sum + item.monthlyDepreciation, 0),
    assetCount: report.length,
  };
  
  return {
    assets: report,
    totals,
  };
};

// Depreciation Schedule Report
export const getDepreciationSchedule = async (assetId: number) => {
  const asset = await FixedAsset.findByPk(assetId);
  if (!asset) throw new Error('Asset not found');
  
  const schedule = [];
  const acquisitionDate = new Date(asset.acquisitionDate);
  const depreciableAmount = Number(asset.acquisitionCost) - Number(asset.residualValue);
  const totalMonths = asset.usefulLife * 12;
  const monthlyDepreciation = depreciableAmount / totalMonths;
  
  let accumulatedDepreciation = 0;
  
  for (let month = 0; month <= totalMonths; month++) {
    const currentDate = new Date(acquisitionDate);
    currentDate.setMonth(currentDate.getMonth() + month);
    
    const periodDepreciation = month === 0 ? 0 : monthlyDepreciation;
    accumulatedDepreciation += periodDepreciation;
    const bookValue = Number(asset.acquisitionCost) - accumulatedDepreciation;
    
    schedule.push({
      period: month,
      date: currentDate,
      periodDepreciation,
      accumulatedDepreciation,
      bookValue: Math.max(bookValue, Number(asset.residualValue)),
    });
  }
  
  return {
    asset: {
      code: asset.code,
      name: asset.name,
      acquisitionCost: Number(asset.acquisitionCost),
      residualValue: Number(asset.residualValue),
      usefulLife: asset.usefulLife,
      depreciationMethod: asset.depreciationMethod,
    },
    schedule,
  };
};

// Investment Tracking Report
export const getInvestmentTrackingReport = async (filters?: { startDate?: string; endDate?: string; type?: string }) => {
  const whereClause: any = {};
  
  if (filters?.type) {
    whereClause.type = filters.type;
  }
  
  const investments = await Investment.findAll({
    where: whereClause,
    order: [['acquisitionDate', 'DESC']],
  });
  
  const report = investments.map(investment => {
    const acquisitionCost = Number(investment.acquisitionCost);
    const currentValue = Number(investment.currentValue);
    const gainLoss = currentValue - acquisitionCost;
    const roi = acquisitionCost > 0 ? (gainLoss / acquisitionCost) * 100 : 0;
    
    const acquisitionDate = new Date(investment.acquisitionDate);
    const today = new Date();
    const daysHeld = Math.floor((today.getTime() - acquisitionDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Calculate annualized return
    const yearsHeld = daysHeld / 365;
    const annualizedReturn = yearsHeld > 0 ? (Math.pow(currentValue / acquisitionCost, 1 / yearsHeld) - 1) * 100 : 0;
    
    // Calculate days to maturity if applicable
    let daysToMaturity = null;
    if (investment.maturityDate) {
      const maturityDate = new Date(investment.maturityDate);
      daysToMaturity = Math.floor((maturityDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    }
    
    return {
      id: investment.id,
      code: investment.code,
      name: investment.name,
      type: investment.type,
      acquisitionDate: investment.acquisitionDate,
      acquisitionCost,
      currentValue,
      quantity: Number(investment.quantity),
      unitCost: Number(investment.unitCost),
      gainLoss,
      roi,
      annualizedReturn,
      daysHeld,
      daysToMaturity,
      maturityDate: investment.maturityDate,
      interestRate: investment.interestRate,
      status: investment.status,
    };
  });
  
  // Calculate portfolio totals
  const totals = {
    totalAcquisitionCost: report.reduce((sum, item) => sum + item.acquisitionCost, 0),
    totalCurrentValue: report.reduce((sum, item) => sum + item.currentValue, 0),
    totalGainLoss: report.reduce((sum, item) => sum + item.gainLoss, 0),
    portfolioROI: 0,
    investmentCount: report.length,
  };
  
  if (totals.totalAcquisitionCost > 0) {
    totals.portfolioROI = (totals.totalGainLoss / totals.totalAcquisitionCost) * 100;
  }
  
  return {
    investments: report,
    totals,
  };
};

// Prepaid Expenses Tracking Report
export const getPrepaidExpensesReport = async (filters?: { startDate?: string; endDate?: string; type?: string }) => {
  const whereClause: any = {};
  
  if (filters?.type) {
    whereClause.type = filters.type;
  }
  
  const expenses = await PrepaidExpense.findAll({
    where: whereClause,
    order: [['startDate', 'DESC']],
  });
  
  const today = new Date();
  
  const report = expenses.map(expense => {
    const startDate = new Date(expense.startDate);
    const endDate = new Date(expense.endDate);
    const totalMonths = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
    const monthsElapsed = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
    const monthsRemaining = Math.max(0, totalMonths - monthsElapsed);
    
    const totalAmount = Number(expense.totalAmount);
    const amortizedAmount = Number(expense.amortizedAmount);
    const remainingAmount = Number(expense.remainingAmount);
    const monthlyAmortization = Number(expense.monthlyAmortization);
    
    const amortizationPercent = totalAmount > 0 ? (amortizedAmount / totalAmount) * 100 : 0;
    const daysToExpiration = Math.floor((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    return {
      id: expense.id,
      code: expense.code,
      name: expense.name,
      type: expense.type,
      startDate: expense.startDate,
      endDate: expense.endDate,
      totalAmount,
      amortizedAmount,
      remainingAmount,
      monthlyAmortization,
      totalMonths,
      monthsElapsed,
      monthsRemaining,
      amortizationPercent,
      daysToExpiration,
      status: expense.status,
    };
  });
  
  // Calculate totals
  const totals = {
    totalAmount: report.reduce((sum, item) => sum + item.totalAmount, 0),
    totalAmortized: report.reduce((sum, item) => sum + item.amortizedAmount, 0),
    totalRemaining: report.reduce((sum, item) => sum + item.remainingAmount, 0),
    expenseCount: report.length,
  };
  
  return {
    expenses: report,
    totals,
  };
};

// Inventory Movement Report
export const getInventoryMovementReport = async (filters: { 
  startDate: string; 
  endDate: string; 
  productId?: number 
}) => {
  const whereClause: any = {
    date: {
      [Op.between]: [filters.startDate, filters.endDate]
    }
  };
  
  const purchases = await Purchase.findAll({
    where: whereClause,
    include: [{ model: PurchaseItem, as: 'items' }],
    order: [['date', 'ASC']],
  });
  
  const sales = await Sale.findAll({
    where: whereClause,
    include: [{ model: SaleItem, as: 'items' }],
    order: [['date', 'ASC']],
  });
  
  // Get all products or specific product
  const productWhere: any = {};
  if (filters.productId) {
    productWhere.id = filters.productId;
  }
  
  const products = await Product.findAll({ where: productWhere });
  
  const report = products.map(product => {
    const movements: any[] = [];
    
    // Collect purchases
    purchases.forEach(purchase => {
      const purchaseItems = (purchase as any).items;
      if (purchaseItems) {
        purchaseItems.forEach((item: any) => {
          if (item.productId === product.id) {
            movements.push({
              date: purchase.date,
              type: 'PURCHASE',
              registrationNumber: purchase.registrationNumber,
              quantity: Number(item.quantity),
              unitCost: Number(item.unitCost),
              total: Number(item.total),
            });
          }
        });
      }
    });
    
    // Collect sales
    sales.forEach(sale => {
      const saleItems = (sale as any).items;
      if (saleItems) {
        saleItems.forEach((item: any) => {
          if (item.productId === product.id) {
            movements.push({
              date: sale.date,
              type: 'SALE',
              registrationNumber: sale.registrationNumber,
              quantity: Number(item.quantity),
              unitPrice: Number(item.salePrice),
              total: Number(item.total),
              costOfGoodsSold: Number(item.costOfGoodsSold),
              grossMargin: Number(item.grossMargin),
            });
          }
        });
      }
    });
    
    // Sort by date
    movements.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Calculate running balance
    let runningBalance = 0;
    movements.forEach(movement => {
      if (movement.type === 'PURCHASE') {
        runningBalance += movement.quantity;
      } else {
        runningBalance -= movement.quantity;
      }
      movement.balance = runningBalance;
    });
    
    const totalPurchases = movements.filter(m => m.type === 'PURCHASE').reduce((sum, m) => sum + m.quantity, 0);
    const totalSales = movements.filter(m => m.type === 'SALE').reduce((sum, m) => sum + m.quantity, 0);
    const totalRevenue = movements.filter(m => m.type === 'SALE').reduce((sum, m) => sum + m.total, 0);
    const totalCost = movements.filter(m => m.type === 'SALE').reduce((sum, m) => sum + (m.costOfGoodsSold || 0), 0);
    const grossMargin = totalRevenue - totalCost;
    
    return {
      productId: product.id,
      productCode: product.code,
      productName: product.name,
      movements,
      summary: {
        totalPurchases,
        totalSales,
        currentBalance: runningBalance,
        totalRevenue,
        totalCost,
        grossMargin,
        grossMarginPercent: totalRevenue > 0 ? (grossMargin / totalRevenue) * 100 : 0,
      },
    };
  });
  
  return report;
};
