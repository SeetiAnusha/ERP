import Financer from '../models/Financer';
// ⚠️ COMMENTED OUT - Client not using Investment Agreements yet
// import InvestmentAgreement from '../models/InvestmentAgreement';
// import CashRegister from '../models/CashRegister';
// import BankRegister from '../models/BankRegister';
import { Op } from 'sequelize';
import sequelize from '../config/database';
import { BaseService } from '../core/BaseService';
import { ValidationError, NotFoundError, BusinessLogicError } from '../core/AppError';

interface CreateFinancerRequest {
  code: string;
  name: string;
  // ✅ FIXED: Include all financer types (old and new for backward compatibility)
  financer_type: 'SHAREHOLDER' | 'SHAREHOLDER_CONTRIBUTOR' | 'FINANCIER' | 'SHAREHOLDER_LENDER' | 'RELATED_PARTY' | 'RELATED_PARTY_LENDER';
  financial_nature: 'EQUITY' | 'LOAN';
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  rnc?: string;
  equity_percentage?: number;
  interest_rate?: number;
  relationship_description?: string;
  status?: 'ACTIVE' | 'INACTIVE';
}

interface UpdateFinancerRequest extends Partial<CreateFinancerRequest> {}

interface RecordContributionRequest {
  amount: number;
  contributionDate: Date;
  paymentMethod: string;
  description?: string;
  cashRegisterId?: number;
  bankAccountId?: number;
}

/**
 * Financer Service - Professional implementation for managing shareholders, financiers, and related parties
 * 
 * Features:
 * - CRUD operations for financers
 * - Contribution tracking
 * - Financial summary calculations
 * - Integration with Investment Agreements
 * - Automatic balance updates
 */
class FinancerService extends BaseService {

  // ==================== PUBLIC API METHODS ====================

  /**
   * Get all financers with optional filtering
   */
  async getAllFinancers(options: any = {}): Promise<any> {
    return this.executeWithRetry(async () => {
      console.log('📊 Service: getAllFinancers called with options:', options);
      
      const whereClause: any = {};
      
      // Filter by financer_type
      if (options.financer_type) {
        whereClause.financer_type = options.financer_type;
      }
      
      // Filter by financial_nature
      if (options.financial_nature) {
        whereClause.financial_nature = options.financial_nature;
      }
      
      // Filter by status
      if (options.status) {
        whereClause.status = options.status;
      } else {
        // Default: only show ACTIVE financers
        whereClause.status = 'ACTIVE';
      }
      
      // Search by name or code
      if (options.search) {
        whereClause[Op.or] = [
          { name: { [Op.like]: `%${options.search}%` } },
          { code: { [Op.like]: `%${options.search}%` } },
          { rnc: { [Op.like]: `%${options.search}%` } }
        ];
      }
      
      const financers = await Financer.findAll({
        where: whereClause,
        order: [['name', 'ASC']],
      });
      
      // Enrich with contribution data
      const enrichedFinancers = await Promise.all(
        financers.map(async (financer) => {
          const contributions = await this.getFinancerContributions(financer.id);
          const summary = this.calculateFinancerSummary(contributions);
          
          return {
            ...financer.toJSON(),
            totalContributions: summary.totalContributions,
            contributionCount: summary.contributionCount,
            lastContributionDate: summary.lastContributionDate,
            averageContribution: summary.averageContribution,
          };
        })
      );
      
      console.log(`✅ Retrieved ${enrichedFinancers.length} financers successfully`);
      return enrichedFinancers;
    });
  }

  /**
   * Get financer by ID with detailed information
   */
  async getFinancerById(id: number): Promise<any> {
    return this.executeWithRetry(async () => {
      this.validateNumeric(id, 'Financer ID', { min: 1 });
      
      const financer = await Financer.findByPk(id);
      if (!financer) {
        throw new NotFoundError(`Financer with ID ${id} not found`);
      }
      
      // Get contributions
      const contributions = await this.getFinancerContributions(id);
      const summary = this.calculateFinancerSummary(contributions);
      
      // Get investment agreements
      // ⚠️ COMMENTED OUT - Client not using Investment Agreements yet
      const agreements: any[] = [];
      /*
      const agreements = await InvestmentAgreement.findAll({
        where: { investorId: id },
        order: [['agreementDate', 'DESC']],
      });
      */
      
      return {
        ...financer.toJSON(),
        contributions,
        summary,
        agreements: agreements.map(a => a), // Empty array for now
      };
    });
  }

  /**
   * Create new financer
   */
  async createFinancer(data: CreateFinancerRequest): Promise<Financer> {
    return this.executeWithTransaction(async (transaction) => {
      // Validation
      this.validateFinancerData(data);
      
      // Check for duplicate code
      const existingFinancer = await Financer.findOne({
        where: { code: data.code },
        transaction
      });
      
      if (existingFinancer) {
        throw new ValidationError(`Financer with code "${data.code}" already exists`);
      }
      
      // Validate business rules
      this.validateBusinessRules(data);
      
      const financer = await Financer.create({
        code: data.code,
        name: data.name,
        financer_type: data.financer_type,
        financial_nature: data.financial_nature,
        contactPerson: data.contactPerson,
        phone: data.phone,
        email: data.email,
        address: data.address,
        rnc: data.rnc,
        equity_percentage: data.equity_percentage,
        interest_rate: data.interest_rate,
        relationship_description: data.relationship_description,
        total_contributed: 0,
        outstanding_balance: 0,
        status: data.status || 'ACTIVE',
      }, { transaction });
      
      console.log(`✅ Created financer ${financer.code} - ${financer.name}`);
      return financer;
    });
  }

  /**
   * Update financer
   */
  async updateFinancer(id: number, data: UpdateFinancerRequest): Promise<Financer> {
    return this.executeWithTransaction(async (transaction) => {
      this.validateNumeric(id, 'Financer ID', { min: 1 });
      
      const financer = await Financer.findByPk(id, { transaction });
      if (!financer) {
        throw new NotFoundError(`Financer with ID ${id} not found`);
      }
      
      // Validate business rules if type or nature is changing
      if (data.financer_type || data.financial_nature) {
        const updatedData = {
          ...financer.toJSON(),
          ...data
        };
        this.validateBusinessRules(updatedData as CreateFinancerRequest);
      }
      
      // Check for duplicate code if code is being changed
      if (data.code && data.code !== financer.code) {
        const existingFinancer = await Financer.findOne({
          where: { 
            code: data.code,
            id: { [Op.ne]: id }
          },
          transaction
        });
        
        if (existingFinancer) {
          throw new ValidationError(`Financer with code "${data.code}" already exists`);
        }
      }
      
      await financer.update(data, { transaction });
      
      console.log(`✅ Updated financer ${financer.code} - ${financer.name}`);
      return financer;
    });
  }

  /**
   * Delete financer (soft delete by setting status to INACTIVE)
   */
  async deleteFinancer(id: number): Promise<{ message: string }> {
    return this.executeWithTransaction(async (transaction) => {
      this.validateNumeric(id, 'Financer ID', { min: 1 });
      
      const financer = await Financer.findByPk(id, { transaction });
      if (!financer) {
        throw new NotFoundError(`Financer with ID ${id} not found`);
      }
      
      // Check if financer has active investment agreements
      // ⚠️ COMMENTED OUT - Client not using Investment Agreements yet
      const activeAgreements: any[] = [];
      /*
      const activeAgreements = await InvestmentAgreement.findAll({
        where: {
          investorId: id,
          status: 'ACTIVE'
        },
        transaction
      });
      */
      
      if (activeAgreements.length > 0) {
        throw new BusinessLogicError(
          `Cannot delete financer with ${activeAgreements.length} active investment agreement(s). ` +
          `Please complete or cancel the agreements first.`
        );
      }
      
      // Soft delete by setting status to INACTIVE
      await financer.update({ status: 'INACTIVE' }, { transaction });
      
      console.log(`✅ Financer ${financer.code} - ${financer.name} marked as INACTIVE`);
      
      return { message: 'Financer deleted successfully (marked as INACTIVE)' };
    });
  }

  /**
   * Record contribution from financer
   * This updates the financer's total_contributed and outstanding_balance
   */
  async recordContribution(
    financerId: number, 
    contributionData: RecordContributionRequest
  ): Promise<any> {
    return this.executeWithTransaction(async (transaction) => {
      this.validateNumeric(financerId, 'Financer ID', { min: 1 });
      
      const financer = await Financer.findByPk(financerId, { transaction });
      if (!financer) {
        throw new NotFoundError(`Financer with ID ${financerId} not found`);
      }
      
      if (financer.status !== 'ACTIVE') {
        throw new BusinessLogicError('Cannot record contribution for inactive financer');
      }
      
      // Validate contribution amount
      if (!contributionData.amount || contributionData.amount <= 0) {
        throw new ValidationError('Contribution amount must be greater than 0');
      }
      
      // Update financer balances
      const newTotalContributed = Number(financer.total_contributed) + contributionData.amount;
      const newOutstandingBalance = Number(financer.outstanding_balance) + contributionData.amount;
      
      await financer.update({
        total_contributed: newTotalContributed,
        outstanding_balance: newOutstandingBalance,
      }, { transaction });
      
      console.log(`✅ Recorded contribution of ₹${contributionData.amount} for financer ${financer.name}`);
      console.log(`   Total Contributed: ₹${financer.total_contributed} → ₹${newTotalContributed}`);
      console.log(`   Outstanding Balance: ₹${financer.outstanding_balance} → ₹${newOutstandingBalance}`);
      
      return {
        financer: financer.toJSON(),
        contribution: contributionData,
        message: `Contribution of ₹${contributionData.amount} recorded successfully`
      };
    });
  }

  /**
   * Get financer summary statistics
   */
  async getFinancerSummary(): Promise<any> {
    return this.executeWithRetry(async () => {
      const financers = await Financer.findAll({
        where: { status: 'ACTIVE' }
      });
      
      const shareholders = financers.filter(f => f.financer_type === 'SHAREHOLDER_CONTRIBUTOR');
      const financiers = financers.filter(f => f.financer_type === 'FINANCIER');
      const relatedParties = financers.filter(f => f.financer_type === 'RELATED_PARTY_LENDER');
      
      const equityFinancers = financers.filter(f => f.financial_nature === 'EQUITY');
      const loanFinancers = financers.filter(f => f.financial_nature === 'LOAN');
      
      const totalContributed = financers.reduce((sum, f) => sum + Number(f.total_contributed), 0);
      const totalOutstanding = financers.reduce((sum, f) => sum + Number(f.outstanding_balance), 0);
      
      const totalEquity = equityFinancers.reduce((sum, f) => sum + Number(f.total_contributed), 0);
      const totalLoans = loanFinancers.reduce((sum, f) => sum + Number(f.total_contributed), 0);
      
      return {
        totalFinancers: financers.length,
        byType: {
          shareholders: shareholders.length,
          financiers: financiers.length,
          relatedParties: relatedParties.length,
        },
        byNature: {
          equity: equityFinancers.length,
          loans: loanFinancers.length,
        },
        financial: {
          totalContributed,
          totalOutstanding,
          totalEquity,
          totalLoans,
          equityPercentage: totalContributed > 0 ? (totalEquity / totalContributed) * 100 : 0,
          loanPercentage: totalContributed > 0 ? (totalLoans / totalContributed) * 100 : 0,
        },
        topContributors: financers
          .sort((a, b) => Number(b.total_contributed) - Number(a.total_contributed))
          .slice(0, 5)
          .map(f => ({
            id: f.id,
            name: f.name,
            type: f.financer_type,
            nature: f.financial_nature,
            totalContributed: Number(f.total_contributed),
            equityPercentage: f.equity_percentage,
          })),
      };
    });
  }

  /**
   * Get active shareholders for Cash Register dropdown
   * Returns only SHAREHOLDER_CONTRIBUTOR type financers with ACTIVE status
   * 
   * Used by: Cash Register page for shareholder contribution selection
   */
  async getActiveShareholders(): Promise<any[]> {
    return this.executeWithRetry(async () => {
      console.log('📊 Service: getActiveShareholders called');
      
      const shareholders = await Financer.findAll({
        where: {
          financer_type: 'SHAREHOLDER_CONTRIBUTOR',
          status: 'ACTIVE'
        },
        attributes: ['id', 'code', 'name', 'equity_percentage', 'total_contributed'],
        order: [['name', 'ASC']]
      });
      
      console.log(`✅ Retrieved ${shareholders.length} active shareholders`);
      
      return shareholders.map(s => ({
        id: s.id,
        code: s.code,
        name: s.name,
        equity_percentage: s.equity_percentage,
        total_contributed: Number(s.total_contributed),
        displayName: `${s.code} - ${s.name}` // For dropdown display
      }));
    });
  }

  /**
   * Get active financiers (lenders) for Cash Register dropdown
   * Returns only FINANCIER type financers with ACTIVE status
   * 
   * Used by: Cash Register page for loan receipt from financiers
   */
  async getActiveFinanciers(): Promise<any[]> {
    return this.executeWithRetry(async () => {
      console.log('📊 Service: getActiveFinanciers called');
      
      const financiers = await Financer.findAll({
        where: {
          financer_type: 'FINANCIER',
          status: 'ACTIVE'
        },
        attributes: ['id', 'code', 'name', 'interest_rate', 'total_contributed', 'outstanding_balance'],
        order: [['name', 'ASC']]
      });
      
      console.log(`✅ Retrieved ${financiers.length} active financiers`);
      
      return financiers.map(f => ({
        id: f.id,
        code: f.code,
        name: f.name,
        interest_rate: f.interest_rate,
        total_contributed: Number(f.total_contributed),
        outstanding_balance: Number(f.outstanding_balance),
        displayName: `${f.code} - ${f.name}` // For dropdown display
      }));
    });
  }

  /**
   * Get active shareholder lenders for Cash Register dropdown
   * Returns only SHAREHOLDER_LENDER type financers with ACTIVE status
   * 
   * Used by: Cash Register page for loan receipt from shareholder lenders
   */
  async getActiveShareholderLenders(): Promise<any[]> {
    return this.executeWithRetry(async () => {
      console.log('📊 Service: getActiveShareholderLenders called');
      
      const shareholderLenders = await Financer.findAll({
        where: {
          financer_type: 'SHAREHOLDER_LENDER',
          status: 'ACTIVE'
        },
        attributes: ['id', 'code', 'name', 'interest_rate', 'total_contributed', 'outstanding_balance'],
        order: [['name', 'ASC']]
      });
      
      console.log(`✅ Retrieved ${shareholderLenders.length} active shareholder lenders`);
      
      return shareholderLenders.map(sl => ({
        id: sl.id,
        code: sl.code,
        name: sl.name,
        interest_rate: sl.interest_rate,
        total_contributed: Number(sl.total_contributed),
        outstanding_balance: Number(sl.outstanding_balance),
        displayName: `${sl.code} - ${sl.name}` // For dropdown display
      }));
    });
  }

  /**
   * Get active related party lenders for Cash Register dropdown
   * Returns only RELATED_PARTY_LENDER type financers with ACTIVE status
   * 
   * Used by: Cash Register page for loan receipt from related party lenders
   */
  async getActiveRelatedPartyLenders(): Promise<any[]> {
    return this.executeWithRetry(async () => {
      console.log('📊 Service: getActiveRelatedPartyLenders called');
      
      const relatedPartyLenders = await Financer.findAll({
        where: {
          financer_type: 'RELATED_PARTY_LENDER',
          status: 'ACTIVE'
        },
        attributes: ['id', 'code', 'name', 'interest_rate', 'total_contributed', 'outstanding_balance', 'relationship_description'],
        order: [['name', 'ASC']]
      });
      
      console.log(`✅ Retrieved ${relatedPartyLenders.length} active related party lenders`);
      
      return relatedPartyLenders.map(rpl => ({
        id: rpl.id,
        code: rpl.code,
        name: rpl.name,
        interest_rate: rpl.interest_rate,
        total_contributed: Number(rpl.total_contributed),
        outstanding_balance: Number(rpl.outstanding_balance),
        relationship_description: rpl.relationship_description,
        displayName: `${rpl.code} - ${rpl.name}` // For dropdown display
      }));
    });
  }

  // ==================== PRIVATE HELPER METHODS ====================

  /**
   * Get all contributions for a financer from investment agreements
   * ⚠️ COMMENTED OUT - Client not using Investment Agreements yet
   */
  private async getFinancerContributions(financerId: number): Promise<any[]> {
    // ⚠️ TEMPORARILY DISABLED - Investment Agreement integration
    // Will be enabled when client needs it
    /*
    const agreements = await InvestmentAgreement.findAll({
      where: { investorId: financerId },
    });
    
    const contributions: any[] = [];
    
    for (const agreement of agreements) {
      // Get cash register transactions
      const cashTransactions = await CashRegister.findAll({
        where: {
          investmentAgreementId: agreement.id,
          relatedDocumentType: { [Op.in]: ['CONTRIBUTION', 'LOAN'] },
        },
        order: [['registrationDate', 'DESC']],
      });
      
      // Get bank register transactions
      const bankTransactions = await BankRegister.findAll({
        where: {
          investmentAgreementId: agreement.id,
          sourceTransactionType: { [Op.in]: ['CONTRIBUTION', 'LOAN'] },
        },
        order: [['registrationDate', 'DESC']],
      });
      
      // Combine transactions
      cashTransactions.forEach(t => {
        contributions.push({
          id: t.id,
          registrationNumber: t.registrationNumber,
          date: t.registrationDate,
          amount: Number(t.amount),
          paymentMethod: t.paymentMethod,
          description: t.description,
          agreementNumber: agreement.agreementNumber,
          agreementType: agreement.agreementType,
          source: 'CASH_REGISTER',
        });
      });
      
      bankTransactions.forEach(t => {
        contributions.push({
          id: t.id,
          registrationNumber: t.registrationNumber,
          date: t.registrationDate,
          amount: Number(t.amount),
          paymentMethod: t.paymentMethod,
          description: t.description,
          agreementNumber: agreement.agreementNumber,
          agreementType: agreement.agreementType,
          source: 'BANK_REGISTER',
        });
      });
    }
    
    return contributions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    */
    
    // Return empty array for now
    return [];
  }

  /**
   * Calculate summary statistics for financer contributions
   */
  private calculateFinancerSummary(contributions: any[]): any {
    const totalContributions = contributions.reduce((sum, c) => sum + c.amount, 0);
    const contributionCount = contributions.length;
    const lastContributionDate = contributions.length > 0 ? contributions[0].date : null;
    const averageContribution = contributionCount > 0 ? totalContributions / contributionCount : 0;
    
    return {
      totalContributions,
      contributionCount,
      lastContributionDate,
      averageContribution,
    };
  }

  /**
   * Validate financer data
   */
  private validateFinancerData(data: CreateFinancerRequest): void {
    if (!data.code || data.code.trim() === '') {
      throw new ValidationError('Financer code is required');
    }
    
    if (!data.name || data.name.trim() === '') {
      throw new ValidationError('Financer name is required');
    }
    
    if (!data.financer_type) {
      throw new ValidationError('Financer type is required');
    }
    
    // ✅ FIXED: Accept both old and new financer type names
    const validTypes = [
      'SHAREHOLDER', 'SHAREHOLDER_CONTRIBUTOR',  // Old and new for shareholder contributor
      'FINANCIER',                                // Same for both
      'RELATED_PARTY', 'RELATED_PARTY_LENDER',   // Old and new for related party lender
      'SHAREHOLDER_LENDER'                        // New for shareholder lender
    ];
    
    if (!validTypes.includes(data.financer_type)) {
      throw new ValidationError('Invalid financer type. Must be one of: SHAREHOLDER_CONTRIBUTOR, FINANCIER, SHAREHOLDER_LENDER, RELATED_PARTY_LENDER');
    }
    
    if (!data.financial_nature) {
      throw new ValidationError('Financial nature is required');
    }
    
    if (!['EQUITY', 'LOAN'].includes(data.financial_nature)) {
      throw new ValidationError('Invalid financial nature');
    }
  }

  /**
   * Validate business rules
   */
  private validateBusinessRules(data: CreateFinancerRequest): void {
    // ✅ FIXED: Handle both old and new financer type names
    const isShareholderContributor = data.financer_type === 'SHAREHOLDER' || data.financer_type === 'SHAREHOLDER_CONTRIBUTOR';
    const isShareholderLender = data.financer_type === 'SHAREHOLDER_LENDER';
    const isFinancier = data.financer_type === 'FINANCIER';
    const isRelatedPartyLender = data.financer_type === 'RELATED_PARTY' || data.financer_type === 'RELATED_PARTY_LENDER';
    
    // Rule 1: SHAREHOLDER_CONTRIBUTOR should typically have EQUITY nature
    if (isShareholderContributor && data.financial_nature === 'LOAN') {
      console.warn('⚠️ Warning: SHAREHOLDER_CONTRIBUTOR with LOAN nature is unusual but allowed');
    }
    
    // Rule 2: FINANCIER should typically have LOAN nature
    if (isFinancier && data.financial_nature === 'EQUITY') {
      console.warn('⚠️ Warning: FINANCIER with EQUITY nature is unusual but allowed');
    }
    
    // Rule 3: SHAREHOLDER_LENDER should have LOAN nature
    if (isShareholderLender && data.financial_nature !== 'LOAN') {
      console.warn('⚠️ Warning: SHAREHOLDER_LENDER should have LOAN nature');
    }
    
    // Rule 4: RELATED_PARTY_LENDER should have LOAN nature
    if (isRelatedPartyLender && data.financial_nature !== 'LOAN') {
      console.warn('⚠️ Warning: RELATED_PARTY_LENDER should have LOAN nature');
    }
    
    // Rule 5: Equity percentage should only be set for SHAREHOLDER_CONTRIBUTOR with EQUITY
    if (data.equity_percentage != null) {
      if (!isShareholderContributor) {
        throw new ValidationError('Equity percentage can only be set for SHAREHOLDER_CONTRIBUTOR type');
      }
      if (data.equity_percentage < 0 || data.equity_percentage > 100) {
        throw new ValidationError('Equity percentage must be between 0 and 100');
      }
    }
    
    // Rule 6: Interest rate should only be set for LOAN nature
    if (data.interest_rate != null) {
      if (data.financial_nature !== 'LOAN') {
        throw new ValidationError('Interest rate can only be set for LOAN financial nature');
      }
      if (data.interest_rate < 0) {
        throw new ValidationError('Interest rate cannot be negative');
      }
    }
  }
}

// Export singleton instance
export const financerService = new FinancerService();

// Export individual methods for backward compatibility
export const getAllFinancers = (options?: any) => financerService.getAllFinancers(options);
export const getFinancerById = (id: number) => financerService.getFinancerById(id);
export const createFinancer = (data: CreateFinancerRequest) => financerService.createFinancer(data);
export const updateFinancer = (id: number, data: UpdateFinancerRequest) => financerService.updateFinancer(id, data);
export const deleteFinancer = (id: number) => financerService.deleteFinancer(id);
export const recordContribution = (financerId: number, data: RecordContributionRequest) => financerService.recordContribution(financerId, data);
export const getFinancerSummary = () => financerService.getFinancerSummary();
export const getActiveShareholders = () => financerService.getActiveShareholders();
export const getActiveFinanciers = () => financerService.getActiveFinanciers();
export const getActiveShareholderLenders = () => financerService.getActiveShareholderLenders();
export const getActiveRelatedPartyLenders = () => financerService.getActiveRelatedPartyLenders();
