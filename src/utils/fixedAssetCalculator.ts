/**
 * Fixed Asset Calculator Utility
 * 
 * Professional-grade fixed asset management with:
 * - Automatic depreciation calculation
 * - Category management with defaults
 * - Maintenance tracking
 * - Warranty tracking
 * - Insurance tracking
 * 
 * @author Senior Developer (20 years experience)
 */

// ===========================
// FIXED ASSET CATEGORIES
// ===========================

export interface AssetCategoryDefaults {
  category: string;
  defaultUsefulLife: number;
  defaultResidualValuePercent: number;
  depreciationMethod: string;
  maintenanceSchedule: string;
  description: string;
}

export const ASSET_CATEGORIES: AssetCategoryDefaults[] = [
  {
    category: 'Land',
    defaultUsefulLife: 0, // Land doesn't depreciate
    defaultResidualValuePercent: 100,
    depreciationMethod: 'NONE',
    maintenanceSchedule: 'NONE',
    description: 'Land and property (non-depreciable)'
  },
  {
    category: 'Buildings',
    defaultUsefulLife: 40,
    defaultResidualValuePercent: 20,
    depreciationMethod: 'STRAIGHT_LINE',
    maintenanceSchedule: 'ANNUALLY',
    description: 'Office buildings, warehouses, factories'
  },
  {
    category: 'Leasehold Improvements',
    defaultUsefulLife: 10,
    defaultResidualValuePercent: 0,
    depreciationMethod: 'STRAIGHT_LINE',
    maintenanceSchedule: 'ANNUALLY',
    description: 'Improvements to leased property'
  },
  {
    category: 'Machinery & Equipment',
    defaultUsefulLife: 10,
    defaultResidualValuePercent: 10,
    depreciationMethod: 'STRAIGHT_LINE',
    maintenanceSchedule: 'QUARTERLY',
    description: 'Manufacturing machinery, production equipment'
  },
  {
    category: 'Vehicles',
    defaultUsefulLife: 5,
    defaultResidualValuePercent: 15,
    depreciationMethod: 'DECLINING_BALANCE',
    maintenanceSchedule: 'QUARTERLY',
    description: 'Cars, trucks, delivery vehicles'
  },
  {
    category: 'Computers & IT Equipment',
    defaultUsefulLife: 3,
    defaultResidualValuePercent: 0,
    depreciationMethod: 'STRAIGHT_LINE',
    maintenanceSchedule: 'ANNUALLY',
    description: 'Computers, servers, networking equipment'
  },
  {
    category: 'Furniture & Fixtures',
    defaultUsefulLife: 10,
    defaultResidualValuePercent: 10,
    depreciationMethod: 'STRAIGHT_LINE',
    maintenanceSchedule: 'NONE',
    description: 'Office furniture, desks, chairs, cabinets'
  },
  {
    category: 'Office Equipment',
    defaultUsefulLife: 7,
    defaultResidualValuePercent: 5,
    depreciationMethod: 'STRAIGHT_LINE',
    maintenanceSchedule: 'ANNUALLY',
    description: 'Printers, copiers, phones, fax machines'
  },
  {
    category: 'Tools & Equipment',
    defaultUsefulLife: 5,
    defaultResidualValuePercent: 5,
    depreciationMethod: 'STRAIGHT_LINE',
    maintenanceSchedule: 'SEMI_ANNUALLY',
    description: 'Hand tools, power tools, workshop equipment'
  },
  {
    category: 'Software & Licenses',
    defaultUsefulLife: 3,
    defaultResidualValuePercent: 0,
    depreciationMethod: 'STRAIGHT_LINE',
    maintenanceSchedule: 'NONE',
    description: 'Software licenses, ERP systems'
  },
  {
    category: 'Other Assets',
    defaultUsefulLife: 5,
    defaultResidualValuePercent: 10,
    depreciationMethod: 'STRAIGHT_LINE',
    maintenanceSchedule: 'ANNUALLY',
    description: 'Other fixed assets not categorized above'
  }
];

// ===========================
// DEPRECIATION METHODS
// ===========================

export const DEPRECIATION_METHODS = [
  { value: 'STRAIGHT_LINE', label: 'Straight-Line', description: 'Equal depreciation each year' },
  { value: 'DECLINING_BALANCE', label: 'Declining Balance', description: 'Higher depreciation in early years' },
  { value: 'DOUBLE_DECLINING', label: 'Double Declining Balance', description: 'Accelerated depreciation' },
  { value: 'UNITS_OF_PRODUCTION', label: 'Units of Production', description: 'Based on usage' },
  { value: 'SUM_OF_YEARS_DIGITS', label: 'Sum of Years Digits', description: 'Accelerated depreciation' },
  { value: 'NONE', label: 'No Depreciation', description: 'For land and non-depreciable assets' }
];

// ===========================
// ASSET STATUS
// ===========================

export const ASSET_STATUS = [
  { value: 'ACTIVE', label: 'Active', color: 'green' },
  { value: 'INACTIVE', label: 'Inactive', color: 'gray' },
  { value: 'UNDER_MAINTENANCE', label: 'Under Maintenance', color: 'yellow' },
  { value: 'DISPOSED', label: 'Disposed', color: 'red' },
  { value: 'SOLD', label: 'Sold', color: 'blue' },
  { value: 'SCRAPPED', label: 'Scrapped', color: 'red' },
  { value: 'LOST', label: 'Lost/Stolen', color: 'red' }
];

// ===========================
// MAINTENANCE SCHEDULE
// ===========================

export const MAINTENANCE_SCHEDULES = [
  { value: 'NONE', label: 'No Maintenance Required' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly (Every 3 months)' },
  { value: 'SEMI_ANNUALLY', label: 'Semi-Annually (Every 6 months)' },
  { value: 'ANNUALLY', label: 'Annually (Once a year)' },
  { value: 'BIANNUALLY', label: 'Bi-Annually (Every 2 years)' }
];

// ===========================
// DISPOSAL REASONS
// ===========================

export const DISPOSAL_REASONS = [
  { value: 'SOLD', label: 'Sold to Third Party' },
  { value: 'SCRAPPED', label: 'Scrapped/Destroyed' },
  { value: 'TRADED', label: 'Traded for New Asset' },
  { value: 'DONATED', label: 'Donated' },
  { value: 'LOST', label: 'Lost' },
  { value: 'STOLEN', label: 'Stolen' },
  { value: 'OBSOLETE', label: 'Obsolete/No Longer Useful' },
  { value: 'DAMAGED', label: 'Damaged Beyond Repair' }
];

// ===========================
// HELPER FUNCTIONS
// ===========================

/**
 * Get category defaults by category name
 */
export function getCategoryDefaults(category: string): AssetCategoryDefaults | undefined {
  return ASSET_CATEGORIES.find(c => c.category === category);
}

/**
 * Calculate straight-line depreciation
 */
export function calculateStraightLineDepreciation(
  acquisitionCost: number,
  residualValue: number,
  usefulLife: number,
  yearsElapsed: number
): number {
  if (usefulLife === 0) return 0; // Land doesn't depreciate
  
  const annualDepreciation = (acquisitionCost - residualValue) / usefulLife;
  const totalDepreciation = annualDepreciation * yearsElapsed;
  
  // Cap at depreciable amount
  const maxDepreciation = acquisitionCost - residualValue;
  return Math.min(totalDepreciation, maxDepreciation);
}

/**
 * Calculate declining balance depreciation
 */
export function calculateDecliningBalanceDepreciation(
  acquisitionCost: number,
  residualValue: number,
  usefulLife: number,
  yearsElapsed: number,
  rate: number = 1.5 // 150% declining balance
): number {
  if (usefulLife === 0) return 0;
  
  const annualRate = rate / usefulLife;
  let bookValue = acquisitionCost;
  let totalDepreciation = 0;
  
  for (let year = 0; year < yearsElapsed; year++) {
    const yearDepreciation = bookValue * annualRate;
    
    // Don't depreciate below residual value
    if (bookValue - yearDepreciation < residualValue) {
      totalDepreciation += (bookValue - residualValue);
      break;
    }
    
    totalDepreciation += yearDepreciation;
    bookValue -= yearDepreciation;
  }
  
  return totalDepreciation;
}

/**
 * Calculate double declining balance depreciation
 */
export function calculateDoubleDecliningDepreciation(
  acquisitionCost: number,
  residualValue: number,
  usefulLife: number,
  yearsElapsed: number
): number {
  return calculateDecliningBalanceDepreciation(
    acquisitionCost,
    residualValue,
    usefulLife,
    yearsElapsed,
    2.0 // 200% declining balance
  );
}

/**
 * Calculate sum of years digits depreciation
 */
export function calculateSumOfYearsDigitsDepreciation(
  acquisitionCost: number,
  residualValue: number,
  usefulLife: number,
  yearsElapsed: number
): number {
  if (usefulLife === 0) return 0;
  
  const depreciableAmount = acquisitionCost - residualValue;
  const sumOfYears = (usefulLife * (usefulLife + 1)) / 2;
  let totalDepreciation = 0;
  
  for (let year = 1; year <= yearsElapsed && year <= usefulLife; year++) {
    const remainingLife = usefulLife - year + 1;
    const yearDepreciation = (remainingLife / sumOfYears) * depreciableAmount;
    totalDepreciation += yearDepreciation;
  }
  
  return totalDepreciation;
}

/**
 * Calculate depreciation based on method
 */
export function calculateDepreciation(
  acquisitionCost: number,
  residualValue: number,
  usefulLife: number,
  depreciationMethod: string,
  acquisitionDate: Date,
  currentDate: Date = new Date()
): number {
  // Calculate years elapsed
  const msPerYear = 1000 * 60 * 60 * 24 * 365.25;
  const yearsElapsed = (currentDate.getTime() - acquisitionDate.getTime()) / msPerYear;
  
  if (yearsElapsed <= 0) return 0;
  if (yearsElapsed >= usefulLife) return acquisitionCost - residualValue;
  
  switch (depreciationMethod) {
    case 'STRAIGHT_LINE':
      return calculateStraightLineDepreciation(acquisitionCost, residualValue, usefulLife, yearsElapsed);
    
    case 'DECLINING_BALANCE':
      return calculateDecliningBalanceDepreciation(acquisitionCost, residualValue, usefulLife, yearsElapsed);
    
    case 'DOUBLE_DECLINING':
      return calculateDoubleDecliningDepreciation(acquisitionCost, residualValue, usefulLife, yearsElapsed);
    
    case 'SUM_OF_YEARS_DIGITS':
      return calculateSumOfYearsDigitsDepreciation(acquisitionCost, residualValue, usefulLife, yearsElapsed);
    
    case 'NONE':
      return 0;
    
    default:
      return calculateStraightLineDepreciation(acquisitionCost, residualValue, usefulLife, yearsElapsed);
  }
}

/**
 * Calculate book value
 */
export function calculateBookValue(
  acquisitionCost: number,
  accumulatedDepreciation: number
): number {
  return Math.max(0, acquisitionCost - accumulatedDepreciation);
}

/**
 * Calculate next maintenance date
 */
export function calculateNextMaintenanceDate(
  lastMaintenanceDate: Date,
  maintenanceSchedule: string
): Date | null {
  if (maintenanceSchedule === 'NONE') return null;
  
  const nextDate = new Date(lastMaintenanceDate);
  
  switch (maintenanceSchedule) {
    case 'MONTHLY':
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    case 'QUARTERLY':
      nextDate.setMonth(nextDate.getMonth() + 3);
      break;
    case 'SEMI_ANNUALLY':
      nextDate.setMonth(nextDate.getMonth() + 6);
      break;
    case 'ANNUALLY':
      nextDate.setFullYear(nextDate.getFullYear() + 1);
      break;
    case 'BIANNUALLY':
      nextDate.setFullYear(nextDate.getFullYear() + 2);
      break;
    default:
      return null;
  }
  
  return nextDate;
}

/**
 * Check if maintenance is due
 */
export function isMaintenanceDue(nextMaintenanceDate: Date | null): boolean {
  if (!nextMaintenanceDate) return false;
  return new Date() >= nextMaintenanceDate;
}

/**
 * Check if warranty is expired
 */
export function isWarrantyExpired(warrantyExpiryDate: Date | null): boolean {
  if (!warrantyExpiryDate) return true;
  return new Date() > warrantyExpiryDate;
}

/**
 * Check if insurance is expired
 */
export function isInsuranceExpired(insuranceExpiryDate: Date | null): boolean {
  if (!insuranceExpiryDate) return true;
  return new Date() > insuranceExpiryDate;
}

/**
 * Get days until expiry
 */
export function getDaysUntilExpiry(expiryDate: Date | null): number | null {
  if (!expiryDate) return null;
  
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysUntil = Math.ceil((expiryDate.getTime() - new Date().getTime()) / msPerDay);
  
  return daysUntil;
}

/**
 * Calculate depreciation percentage
 */
export function calculateDepreciationPercentage(
  acquisitionCost: number,
  accumulatedDepreciation: number
): number {
  if (acquisitionCost === 0) return 0;
  return (accumulatedDepreciation / acquisitionCost) * 100;
}

/**
 * Calculate gain/loss on disposal
 */
export function calculateDisposalGainLoss(
  bookValue: number,
  disposalValue: number
): { amount: number; type: 'GAIN' | 'LOSS' | 'NONE' } {
  const difference = disposalValue - bookValue;
  
  if (difference > 0) {
    return { amount: difference, type: 'GAIN' };
  } else if (difference < 0) {
    return { amount: Math.abs(difference), type: 'LOSS' };
  } else {
    return { amount: 0, type: 'NONE' };
  }
}
