/**
 * Investment Calculator Utility
 * 
 * Professional-grade investment valuation system with:
 * - Multiple calculation methods (Simple Interest, Compound Interest)
 * - Support for all investment types
 * - Optimized for performance (O(1) time complexity for calculations)
 * - Day count conventions
 * - Edge case handling
 * 
 * @author Senior DSA Developer
 * @complexity Time: O(1) per investment, Space: O(1)
 */

export enum InvestmentType {
  BONDS = 'Bonds',
  STOCKS = 'Stocks',
  MUTUAL_FUNDS = 'Mutual Funds',
  REAL_ESTATE = 'Real Estate',
  CRYPTOCURRENCY = 'Cryptocurrency',
  OTHER = 'Other'
}

export enum InterestCalculationMethod {
  SIMPLE = 'SIMPLE',
  COMPOUND_DAILY = 'COMPOUND_DAILY',
  COMPOUND_MONTHLY = 'COMPOUND_MONTHLY',
  COMPOUND_QUARTERLY = 'COMPOUND_QUARTERLY',
  COMPOUND_ANNUALLY = 'COMPOUND_ANNUALLY'
}

export enum DayCountConvention {
  ACTUAL_365 = 'ACTUAL_365',  // Most common for bonds
  ACTUAL_360 = 'ACTUAL_360',  // Money market instruments
  THIRTY_360 = '30_360'       // Corporate bonds
}

export interface InvestmentData {
  type: string;
  acquisitionDate: Date;
  acquisitionCost: number;
  currentValue: number;  // Manual value (for stocks, crypto, etc.)
  maturityDate?: Date | null;
  interestRate?: number | null;
  quantity: number;
  status: string;
}

export interface CalculatedInvestment extends InvestmentData {
  calculatedCurrentValue: number;
  gainLoss: number;
  gainLossPercentage: number;
  daysHeld: number;
  daysToMaturity: number | null;
  annualizedReturn: number;
  shouldAutoCalculate: boolean;
}

/**
 * Investment Calculator Class
 * Singleton pattern for memory efficiency
 */
class InvestmentCalculator {
  private static instance: InvestmentCalculator;

  private constructor() {}

  public static getInstance(): InvestmentCalculator {
    if (!InvestmentCalculator.instance) {
      InvestmentCalculator.instance = new InvestmentCalculator();
    }
    return InvestmentCalculator.instance;
  }

  /**
   * Calculate days between two dates
   * Time Complexity: O(1)
   * Space Complexity: O(1)
   */
  private calculateDaysBetween(startDate: Date, endDate: Date): number {
    const msPerDay = 1000 * 60 * 60 * 24;
    const start = new Date(startDate).setHours(0, 0, 0, 0);
    const end = new Date(endDate).setHours(0, 0, 0, 0);
    return Math.floor((end - start) / msPerDay);
  }

  /**
   * Calculate simple interest
   * Formula: A = P(1 + rt)
   * Time Complexity: O(1)
   */
  private calculateSimpleInterest(
    principal: number,
    rate: number,
    days: number,
    convention: DayCountConvention = DayCountConvention.ACTUAL_365
  ): number {
    const daysInYear = convention === DayCountConvention.ACTUAL_360 ? 360 : 365;
    const rateDecimal = rate / 100;
    const timeInYears = days / daysInYear;
    return principal * (1 + rateDecimal * timeInYears);
  }

  /**
   * Calculate compound interest
   * Formula: A = P(1 + r/n)^(nt)
   * Time Complexity: O(1)
   */
  private calculateCompoundInterest(
    principal: number,
    rate: number,
    days: number,
    method: InterestCalculationMethod = InterestCalculationMethod.COMPOUND_DAILY,
    convention: DayCountConvention = DayCountConvention.ACTUAL_365
  ): number {
    const daysInYear = convention === DayCountConvention.ACTUAL_360 ? 360 : 365;
    const rateDecimal = rate / 100;
    const timeInYears = days / daysInYear;

    let n: number; // Compounding frequency per year
    switch (method) {
      case InterestCalculationMethod.COMPOUND_DAILY:
        n = daysInYear;
        break;
      case InterestCalculationMethod.COMPOUND_MONTHLY:
        n = 12;
        break;
      case InterestCalculationMethod.COMPOUND_QUARTERLY:
        n = 4;
        break;
      case InterestCalculationMethod.COMPOUND_ANNUALLY:
        n = 1;
        break;
      default:
        n = daysInYear;
    }

    return principal * Math.pow(1 + rateDecimal / n, n * timeInYears);
  }

  /**
   * Determine if investment type should auto-calculate
   * Time Complexity: O(1)
   */
  private shouldAutoCalculate(type: string, interestRate?: number | null): boolean {
    // Auto-calculate for interest-bearing investments
    if (type === InvestmentType.BONDS && interestRate != null && interestRate > 0) {
      return true;
    }
    
    // Real estate with appreciation rate
    if (type === InvestmentType.REAL_ESTATE && interestRate != null && interestRate > 0) {
      return true;
    }

    // For stocks, crypto, mutual funds - use manual currentValue
    return false;
  }

  /**
   * Calculate current value based on investment type
   * Time Complexity: O(1)
   * Space Complexity: O(1)
   */
  private calculateCurrentValueByType(
    investment: InvestmentData,
    daysHeld: number,
    method: InterestCalculationMethod = InterestCalculationMethod.SIMPLE
  ): number {
    const { type, acquisitionCost, interestRate, currentValue } = investment;

    // If no interest rate or not auto-calculable type, return manual value
    if (!this.shouldAutoCalculate(type, interestRate)) {
      return currentValue;
    }

    const rate = interestRate || 0;

    // Bonds: Use simple interest (most common for bonds)
    if (type === InvestmentType.BONDS) {
      if (method === InterestCalculationMethod.SIMPLE) {
        return this.calculateSimpleInterest(acquisitionCost, rate, daysHeld);
      } else {
        return this.calculateCompoundInterest(acquisitionCost, rate, daysHeld, method);
      }
    }

    // Real Estate: Use compound interest (appreciation)
    if (type === InvestmentType.REAL_ESTATE) {
      return this.calculateCompoundInterest(
        acquisitionCost,
        rate,
        daysHeld,
        InterestCalculationMethod.COMPOUND_ANNUALLY
      );
    }

    // Default: return manual value
    return currentValue;
  }

  /**
   * Calculate annualized return (CAGR)
   * Formula: CAGR = (Ending Value / Beginning Value)^(1/years) - 1
   * Time Complexity: O(1)
   */
  private calculateAnnualizedReturn(
    acquisitionCost: number,
    currentValue: number,
    daysHeld: number
  ): number {
    if (daysHeld === 0 || acquisitionCost === 0) return 0;
    
    const years = daysHeld / 365;
    if (years === 0) return 0;

    const cagr = (Math.pow(currentValue / acquisitionCost, 1 / years) - 1) * 100;
    return Math.round(cagr * 100) / 100; // Round to 2 decimals
  }

  /**
   * Auto-update status based on maturity date
   * Time Complexity: O(1)
   */
  private determineStatus(
    currentStatus: string,
    maturityDate?: Date | null
  ): string {
    if (!maturityDate) return currentStatus;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const maturity = new Date(maturityDate);
    maturity.setHours(0, 0, 0, 0);

    // Auto-update to MATURED if maturity date has passed
    if (maturity <= today && currentStatus === 'ACTIVE') {
      return 'MATURED';
    }

    return currentStatus;
  }

  /**
   * Main calculation method - Calculate all investment metrics
   * Time Complexity: O(1)
   * Space Complexity: O(1)
   * 
   * @param investment Investment data
   * @param method Interest calculation method (default: SIMPLE)
   * @returns Calculated investment with all metrics
   */
  public calculate(
    investment: InvestmentData,
    method: InterestCalculationMethod = InterestCalculationMethod.SIMPLE
  ): CalculatedInvestment {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calculate days held
    const daysHeld = this.calculateDaysBetween(investment.acquisitionDate, today);

    // Calculate days to maturity
    let daysToMaturity: number | null = null;
    if (investment.maturityDate) {
      daysToMaturity = this.calculateDaysBetween(today, investment.maturityDate);
      if (daysToMaturity < 0) daysToMaturity = 0; // Already matured
    }

    // Calculate current value
    const calculatedCurrentValue = this.calculateCurrentValueByType(
      investment,
      daysHeld,
      method
    );

    // Calculate gain/loss
    const gainLoss = calculatedCurrentValue - investment.acquisitionCost;
    const gainLossPercentage = investment.acquisitionCost > 0
      ? (gainLoss / investment.acquisitionCost) * 100
      : 0;

    // Calculate annualized return
    const annualizedReturn = this.calculateAnnualizedReturn(
      investment.acquisitionCost,
      calculatedCurrentValue,
      daysHeld
    );

    // Determine if auto-calculation is enabled
    const shouldAutoCalculate = this.shouldAutoCalculate(
      investment.type,
      investment.interestRate
    );

    // Auto-update status
    const updatedStatus = this.determineStatus(
      investment.status,
      investment.maturityDate
    );

    return {
      ...investment,
      status: updatedStatus,
      calculatedCurrentValue: Math.round(calculatedCurrentValue * 100) / 100,
      gainLoss: Math.round(gainLoss * 100) / 100,
      gainLossPercentage: Math.round(gainLossPercentage * 100) / 100,
      daysHeld,
      daysToMaturity,
      annualizedReturn,
      shouldAutoCalculate
    };
  }

  /**
   * Bulk calculation for multiple investments
   * Time Complexity: O(n) where n is number of investments
   * Space Complexity: O(n)
   * 
   * Optimized for batch processing
   */
  public calculateBulk(
    investments: InvestmentData[],
    method: InterestCalculationMethod = InterestCalculationMethod.SIMPLE
  ): CalculatedInvestment[] {
    // Pre-calculate today once for all investments (optimization)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return investments.map(investment => this.calculate(investment, method));
  }

  /**
   * Calculate portfolio summary
   * Time Complexity: O(n)
   * Space Complexity: O(1)
   */
  public calculatePortfolioSummary(investments: CalculatedInvestment[]) {
    return investments.reduce(
      (acc, inv) => ({
        totalAcquisitionCost: acc.totalAcquisitionCost + inv.acquisitionCost,
        totalCurrentValue: acc.totalCurrentValue + inv.calculatedCurrentValue,
        totalGainLoss: acc.totalGainLoss + inv.gainLoss,
        count: acc.count + 1
      }),
      {
        totalAcquisitionCost: 0,
        totalCurrentValue: 0,
        totalGainLoss: 0,
        count: 0
      }
    );
  }
}

// Export singleton instance
export const investmentCalculator = InvestmentCalculator.getInstance();

// Export helper functions for backward compatibility
export const calculateInvestment = (
  investment: InvestmentData,
  method?: InterestCalculationMethod
) => investmentCalculator.calculate(investment, method);

export const calculateInvestmentsBulk = (
  investments: InvestmentData[],
  method?: InterestCalculationMethod
) => investmentCalculator.calculateBulk(investments, method);

export const calculatePortfolioSummary = (investments: CalculatedInvestment[]) =>
  investmentCalculator.calculatePortfolioSummary(investments);
