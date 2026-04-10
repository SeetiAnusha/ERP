import { Op } from 'sequelize';
import Payment from '../models/Payment';
import PaymentInvoiceApplication from '../models/PaymentInvoiceApplication';
import Purchase from '../models/Purchase';
import Sale from '../models/Sale';
import AccountsPayable from '../models/AccountsPayable';
import AccountsReceivable from '../models/AccountsReceivable';
import BankRegister from '../models/BankRegister';
import CashRegister from '../models/CashRegister';
import { BaseService } from '../core/BaseService';
import { NotFoundError, ValidationError } from '../core/AppError';

interface ImpactItem {
  type: string;
  description: string;
  amount?: number;
  entity?: string;
  entityId?: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

interface FinancialImpact {
  cashFlow: number;
  accountsReceivable: number;
  accountsPayable: number;
  bankBalance: number;
  cashRegisterBalance: number;
}

interface TransactionImpactAnalysis {
  entityType: string;
  entityId: number;
  entityData: any;
  directImpacts: ImpactItem[];
  cascadeImpacts: ImpactItem[];
  financialImpact: FinancialImpact;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  requiredApprovals: string[];
  estimatedReversalTime: number; // in minutes
  complianceNotes: string[];
}

/**
 * Transaction Impact Analysis Service
 * 
 * Analyzes the impact of deleting transactions across the entire ERP system.
 * Provides comprehensive impact assessment for approval workflow decisions.
 */
class TransactionImpactAnalysisService extends BaseService {

  /**
   * Get available transactions for deletion dropdown
   */
  async getAvailableTransactions(entityType: string): Promise<any[]> {
    return this.executeWithRetry(async () => {
      let model: any;
      let fields: string[];
      let additionalInfo = '';

      switch (entityType.toLowerCase()) {
        case 'payment':
          model = Payment;
          fields = ['id', 'registrationNumber', 'paymentAmount', 'type', 'relatedEntityType'];
          additionalInfo = 'type';
          break;
        case 'sale':
          model = Sale;
          fields = ['id', 'registrationNumber', 'total', 'clientId'];
          additionalInfo = 'clientId';
          break;
        case 'purchase':
          model = Purchase;
          fields = ['id', 'registrationNumber', 'total', 'supplierId'];
          additionalInfo = 'supplierId';
          break;
        case 'accountspayable':
          model = AccountsPayable;
          fields = ['id', 'registrationNumber', 'amount', 'type', 'supplierName'];
          additionalInfo = 'type';
          break;
        case 'accountsreceivable':
          model = AccountsReceivable;
          fields = ['id', 'registrationNumber', 'amount', 'type', 'clientName'];
          additionalInfo = 'type';
          break;
        case 'bankregister':
          model = BankRegister;
          fields = ['id', 'registrationNumber', 'amount', 'transactionType', 'description'];
          additionalInfo = 'transactionType';
          break;
        case 'cashregister':
          model = CashRegister;
          fields = ['id', 'registrationNumber', 'amount', 'transactionType', 'description'];
          additionalInfo = 'transactionType';
          break;
        default:
          throw new ValidationError(`Unsupported entity type: ${entityType}`);
      }

      const transactions = await model.findAll({
        attributes: fields,
        where: {
          [Op.or]: [
            { deletion_status: 'NONE' },
            { deletion_status: { [Op.is]: null } }
          ]
        },
        order: [['id', 'ASC']],
        limit: 50 // Limit for performance
      });

      return transactions.map((transaction: any) => {
        const data = transaction.toJSON();
        
        // Create description based on entity type
        let description = '';
        switch (entityType.toLowerCase()) {
          case 'payment':
            description = `${data.type} Payment`;
            break;
          case 'sale':
            description = `Sale Transaction`;
            break;
          case 'purchase':
            description = `Purchase Transaction`;
            break;
          case 'accountspayable':
            description = `AP: ${data.supplierName || data.type}`;
            break;
          case 'accountsreceivable':
            description = `AR: ${data.clientName || data.type}`;
            break;
          case 'bankregister':
            description = `Bank ${data.transactionType}: ${data.description || 'Transaction'}`;
            break;
          case 'cashregister':
            description = `Cash ${data.transactionType}: ${data.description || 'Transaction'}`;
            break;
        }

        return {
          id: data.id,
          registrationNumber: data.registrationNumber,
          amount: parseFloat(data.amount || data.total || data.paymentAmount || 0),
          description: description.substring(0, 50) // Limit description length
        };
      });
    });
  }

  /**
   * Analyze impact of deleting any transaction type
   */
  async analyzeTransactionDeletion(entityType: string, entityId: number): Promise<TransactionImpactAnalysis> {
    return this.executeWithRetry(async () => {
      this.validateNumeric(entityId, 'Entity ID', { min: 1 });
      
      switch (entityType.toLowerCase()) {
        case 'payment':
          return await this.analyzePaymentDeletion(entityId);
        case 'purchase':
          return await this.analyzePurchaseDeletion(entityId);
        case 'sale':
          return await this.analyzeSaleDeletion(entityId);
        case 'accountspayable':
          return await this.analyzeAccountsPayableDeletion(entityId);
        case 'accountsreceivable':
          return await this.analyzeAccountsReceivableDeletion(entityId);
        case 'bankregister':
          return await this.analyzeBankRegisterDeletion(entityId);
        case 'cashregister':
          return await this.analyzeCashRegisterDeletion(entityId);
        default:
          throw new ValidationError(`Unsupported entity type: ${entityType}`);
      }
    });
  }

  /**
   * Analyze Payment Deletion Impact
   */
  private async analyzePaymentDeletion(paymentId: number): Promise<TransactionImpactAnalysis> {
    const payment = await Payment.findByPk(paymentId, {
      include: [
        { model: PaymentInvoiceApplication, as: 'applications' }
      ]
    });

    if (!payment) {
      throw new NotFoundError(`Payment with ID ${paymentId} not found`);
    }

    const directImpacts: ImpactItem[] = [];
    const cascadeImpacts: ImpactItem[] = [];
    const financialImpact: FinancialImpact = {
      cashFlow: 0,
      accountsReceivable: 0,
      accountsPayable: 0,
      bankBalance: 0,
      cashRegisterBalance: 0
    };

    // Analyze invoice applications
    if (payment.applications && payment.applications.length > 0) {
      for (const app of payment.applications) {
        if (app.invoiceType === 'Purchase') {
          const purchase = await Purchase.findByPk(app.invoiceId);
          if (purchase) {
            directImpacts.push({
              type: 'Accounts Payable',
              description: `Purchase ${purchase.registrationNumber} will revert from "Paid" to "Pending" status`,
              amount: parseFloat(app.appliedAmount.toString()),
              entity: 'Purchase',
              entityId: purchase.id,
              severity: 'MEDIUM'
            });

            financialImpact.accountsPayable += parseFloat(app.appliedAmount.toString());

            // Check supplier relationship impact
            if (purchase.supplierId) {
              cascadeImpacts.push({
                type: 'Supplier Relationship',
                description: `Supplier payment reversal may affect credit terms and future purchases`,
                entity: 'Supplier',
                entityId: purchase.supplierId,
                severity: 'HIGH'
              });
            }
          }
        } else if (app.invoiceType === 'Sale') {
          const sale = await Sale.findByPk(app.invoiceId);
          if (sale) {
            directImpacts.push({
              type: 'Accounts Receivable',
              description: `Sale ${sale.registrationNumber} will revert from "Collected" to "Pending" status`,
              amount: parseFloat(app.appliedAmount.toString()),
              entity: 'Sale',
              entityId: sale.id,
              severity: 'MEDIUM'
            });

            financialImpact.accountsReceivable += parseFloat(app.appliedAmount.toString());

            // Check client relationship impact
            if (sale.clientId) {
              cascadeImpacts.push({
                type: 'Client Relationship',
                description: `Client payment reversal may affect credit standing and future sales`,
                entity: 'Client',
                entityId: sale.clientId,
                severity: 'MEDIUM'
              });
            }
          }
        }
      }
    }

    // Analyze cash register impact
    if (payment.paymentMethod === 'Cash') {
      directImpacts.push({
        type: 'Cash Register',
        description: `Cash register will need OUTFLOW entry of $${payment.paymentAmount} to reverse cash receipt`,
        amount: -parseFloat(payment.paymentAmount.toString()),
        entity: 'CashRegister',
        severity: 'HIGH'
      });

      financialImpact.cashRegisterBalance -= parseFloat(payment.paymentAmount.toString());
    }

    // Analyze bank register impact
    directImpacts.push({
      type: 'Bank Register',
      description: `Bank account will need reversal entry to restore previous balance`,
      amount: -parseFloat(payment.paymentAmount.toString()),
      entity: 'BankRegister',
      severity: 'HIGH'
    });

    financialImpact.bankBalance -= parseFloat(payment.paymentAmount.toString());
    financialImpact.cashFlow -= parseFloat(payment.paymentAmount.toString());

    // Check for credit balances created by this payment
    const excessAmount = parseFloat(payment.excessAmount?.toString() || '0');
    if (excessAmount > 0) {
      cascadeImpacts.push({
        type: 'Credit Balance',
        description: `Credit balance of $${excessAmount} will be removed from customer/supplier account`,
        amount: excessAmount,
        severity: 'MEDIUM'
      });
    }

    // Calculate risk level and required approvals
    const totalAmount = parseFloat(payment.paymentAmount.toString());
    const riskLevel = this.calculateRiskLevel(totalAmount, directImpacts.length + cascadeImpacts.length);
    const requiredApprovals = this.determineRequiredApprovals(totalAmount, riskLevel, payment.type);

    return {
      entityType: 'Payment',
      entityId: paymentId,
      entityData: payment.toJSON(),
      directImpacts,
      cascadeImpacts,
      financialImpact,
      riskLevel,
      requiredApprovals,
      estimatedReversalTime: this.calculateReversalTime(directImpacts.length + cascadeImpacts.length),
      complianceNotes: this.generateComplianceNotes('Payment', totalAmount, riskLevel)
    };
  }

  /**
   * Analyze Sale Deletion Impact
   */
  private async analyzeSaleDeletion(saleId: number): Promise<TransactionImpactAnalysis> {
    const sale = await Sale.findByPk(saleId);
    
    if (!sale) {
      throw new NotFoundError(`Sale with ID ${saleId} not found`);
    }

    const directImpacts: ImpactItem[] = [];
    const cascadeImpacts: ImpactItem[] = [];
    const financialImpact: FinancialImpact = {
      cashFlow: 0,
      accountsReceivable: -parseFloat(sale.total.toString()),
      accountsPayable: 0,
      bankBalance: 0,
      cashRegisterBalance: 0
    };

    // Check if sale has been collected
    const collectedAmount = parseFloat(sale.collectedAmount?.toString() || '0');
    if (collectedAmount > 0) {
      directImpacts.push({
        type: 'Payment Reversal Required',
        description: `Sale has been collected $${collectedAmount}. Collection must be reversed first.`,
        amount: collectedAmount,
        severity: 'CRITICAL'
      });

      cascadeImpacts.push({
        type: 'Bank Account Impact',
        description: `Bank account will be debited $${collectedAmount} when collection is reversed`,
        amount: -collectedAmount,
        severity: 'HIGH'
      });

      financialImpact.cashFlow -= collectedAmount;
      financialImpact.bankBalance -= collectedAmount;
    }

    // Check for related AR records
    const arRecords = await AccountsReceivable.findAll({
      where: {
        relatedDocumentNumber: sale.registrationNumber
      }
    });

    if (arRecords.length > 0) {
      directImpacts.push({
        type: 'Accounts Receivable',
        description: `${arRecords.length} AR record(s) will be marked as cancelled`,
        severity: 'MEDIUM'
      });
    }

    // Check client relationship
    if (sale.clientId) {
      cascadeImpacts.push({
        type: 'Client Relationship',
        description: `Sale cancellation may affect client credit standing and future sales`,
        entity: 'Client',
        entityId: sale.clientId,
        severity: 'MEDIUM'
      });
    }

    const totalAmount = parseFloat(sale.total.toString());
    const riskLevel = this.calculateRiskLevel(totalAmount, directImpacts.length + cascadeImpacts.length);
    const requiredApprovals = this.determineRequiredApprovals(totalAmount, riskLevel, 'Sale');

    return {
      entityType: 'Sale',
      entityId: saleId,
      entityData: sale.toJSON(),
      directImpacts,
      cascadeImpacts,
      financialImpact,
      riskLevel,
      requiredApprovals,
      estimatedReversalTime: this.calculateReversalTime(directImpacts.length + cascadeImpacts.length),
      complianceNotes: this.generateComplianceNotes('Sale', totalAmount, riskLevel)
    };
  }

  /**
   * Analyze Purchase Deletion Impact
   */
  private async analyzePurchaseDeletion(purchaseId: number): Promise<TransactionImpactAnalysis> {
    const purchase = await Purchase.findByPk(purchaseId);
    
    if (!purchase) {
      throw new NotFoundError(`Purchase with ID ${purchaseId} not found`);
    }

    const directImpacts: ImpactItem[] = [];
    const cascadeImpacts: ImpactItem[] = [];
    const financialImpact: FinancialImpact = {
      cashFlow: 0,
      accountsReceivable: 0,
      accountsPayable: -parseFloat(purchase.total.toString()),
      bankBalance: 0,
      cashRegisterBalance: 0
    };

    // Check if purchase has been paid
    const paidAmount = parseFloat(purchase.paidAmount.toString());
    if (paidAmount > 0) {
      directImpacts.push({
        type: 'Payment Reversal Required',
        description: `Purchase has been paid $${paidAmount}. Payment must be reversed first.`,
        amount: paidAmount,
        severity: 'CRITICAL'
      });

      cascadeImpacts.push({
        type: 'Bank Account Impact',
        description: `Bank account will be credited $${paidAmount} when payment is reversed`,
        amount: paidAmount,
        severity: 'HIGH'
      });

      financialImpact.cashFlow += paidAmount;
      financialImpact.bankBalance += paidAmount;
    }

    // Check for related AP records
    const apRecords = await AccountsPayable.findAll({
      where: {
        relatedDocumentNumber: purchase.registrationNumber
      }
    });

    if (apRecords.length > 0) {
      directImpacts.push({
        type: 'Accounts Payable',
        description: `${apRecords.length} AP record(s) will be marked as cancelled`,
        severity: 'MEDIUM'
      });
    }

    // Check inventory impact
    cascadeImpacts.push({
      type: 'Inventory Impact',
      description: `Product quantities and costs may need manual adjustment`,
      severity: 'HIGH'
    });

    // Check supplier relationship
    if (purchase.supplierId) {
      cascadeImpacts.push({
        type: 'Supplier Relationship',
        description: `Purchase cancellation may affect supplier agreements and future orders`,
        entity: 'Supplier',
        entityId: purchase.supplierId,
        severity: 'MEDIUM'
      });
    }

    const totalAmount = parseFloat(purchase.total.toString());
    const riskLevel = this.calculateRiskLevel(totalAmount, directImpacts.length + cascadeImpacts.length);
    const requiredApprovals = this.determineRequiredApprovals(totalAmount, riskLevel, 'Purchase');

    return {
      entityType: 'Purchase',
      entityId: purchaseId,
      entityData: purchase.toJSON(),
      directImpacts,
      cascadeImpacts,
      financialImpact,
      riskLevel,
      requiredApprovals,
      estimatedReversalTime: this.calculateReversalTime(directImpacts.length + cascadeImpacts.length),
      complianceNotes: this.generateComplianceNotes('Purchase', totalAmount, riskLevel)
    };
  }

  /**
   * Analyze Accounts Payable Deletion Impact
   */
  private async analyzeAccountsPayableDeletion(apId: number): Promise<TransactionImpactAnalysis> {
    const ap = await AccountsPayable.findByPk(apId);
    
    if (!ap) {
      throw new NotFoundError(`Accounts Payable with ID ${apId} not found`);
    }

    const directImpacts: ImpactItem[] = [];
    const cascadeImpacts: ImpactItem[] = [];
    const financialImpact: FinancialImpact = {
      cashFlow: 0,
      accountsReceivable: 0,
      accountsPayable: -parseFloat(ap.amount.toString()),
      bankBalance: 0,
      cashRegisterBalance: 0
    };

    // Check if AP has been paid
    const paidAmount = parseFloat(ap.paidAmount.toString());
    if (paidAmount > 0) {
      directImpacts.push({
        type: 'Payment Reversal Required',
        description: `AP has been paid $${paidAmount}. Related payments must be reversed.`,
        amount: paidAmount,
        severity: 'CRITICAL'
      });

      financialImpact.cashFlow += paidAmount;
      financialImpact.bankBalance += paidAmount;
    }

    // Check for credit card transactions
    if (ap.type === 'CREDIT_CARD_PURCHASE' && ap.cardId) {
      cascadeImpacts.push({
        type: 'Credit Card Dispute',
        description: `Credit card transaction may require dispute with card company`,
        severity: 'HIGH'
      });
    }

    const totalAmount = parseFloat(ap.amount.toString());
    const riskLevel = this.calculateRiskLevel(totalAmount, directImpacts.length + cascadeImpacts.length);
    const requiredApprovals = this.determineRequiredApprovals(totalAmount, riskLevel, 'AccountsPayable');

    return {
      entityType: 'AccountsPayable',
      entityId: apId,
      entityData: ap.toJSON(),
      directImpacts,
      cascadeImpacts,
      financialImpact,
      riskLevel,
      requiredApprovals,
      estimatedReversalTime: this.calculateReversalTime(directImpacts.length + cascadeImpacts.length),
      complianceNotes: this.generateComplianceNotes('AccountsPayable', totalAmount, riskLevel)
    };
  }

  /**
   * Analyze Accounts Receivable Deletion Impact
   */
  private async analyzeAccountsReceivableDeletion(arId: number): Promise<TransactionImpactAnalysis> {
    const ar = await AccountsReceivable.findByPk(arId);
    
    if (!ar) {
      throw new NotFoundError(`Accounts Receivable with ID ${arId} not found`);
    }

    const directImpacts: ImpactItem[] = [];
    const cascadeImpacts: ImpactItem[] = [];
    const financialImpact: FinancialImpact = {
      cashFlow: 0,
      accountsReceivable: -parseFloat(ar.amount.toString()),
      accountsPayable: 0,
      bankBalance: 0,
      cashRegisterBalance: 0
    };

    // Check if AR has been received
    const receivedAmount = parseFloat(ar.receivedAmount.toString());
    if (receivedAmount > 0) {
      directImpacts.push({
        type: 'Payment Reversal Required',
        description: `AR has been collected $${receivedAmount}. Collection must be reversed.`,
        amount: receivedAmount,
        severity: 'CRITICAL'
      });

      financialImpact.cashFlow -= receivedAmount;
      financialImpact.bankBalance -= receivedAmount;
    }

    // Check for credit card sales
    if (ar.type === 'CREDIT_CARD_SALE' && ar.cardNetwork) {
      cascadeImpacts.push({
        type: 'Credit Card Network',
        description: `${ar.cardNetwork} transaction may require reversal through payment processor`,
        severity: 'HIGH'
      });
    }

    const totalAmount = parseFloat(ar.amount.toString());
    const riskLevel = this.calculateRiskLevel(totalAmount, directImpacts.length + cascadeImpacts.length);
    const requiredApprovals = this.determineRequiredApprovals(totalAmount, riskLevel, 'AccountsReceivable');

    return {
      entityType: 'AccountsReceivable',
      entityId: arId,
      entityData: ar.toJSON(),
      directImpacts,
      cascadeImpacts,
      financialImpact,
      riskLevel,
      requiredApprovals,
      estimatedReversalTime: this.calculateReversalTime(directImpacts.length + cascadeImpacts.length),
      complianceNotes: this.generateComplianceNotes('AccountsReceivable', totalAmount, riskLevel)
    };
  }

  /**
   * Analyze Bank Register Deletion Impact
   */
  private async analyzeBankRegisterDeletion(brId: number): Promise<TransactionImpactAnalysis> {
    const br = await BankRegister.findByPk(brId);
    
    if (!br) {
      throw new NotFoundError(`Bank Register with ID ${brId} not found`);
    }

    const directImpacts: ImpactItem[] = [];
    const cascadeImpacts: ImpactItem[] = [];
    const amount = parseFloat(br.amount.toString());
    
    const financialImpact: FinancialImpact = {
      cashFlow: br.transactionType === 'INFLOW' ? -amount : amount,
      accountsReceivable: 0,
      accountsPayable: 0,
      bankBalance: br.transactionType === 'INFLOW' ? -amount : amount,
      cashRegisterBalance: 0
    };

    directImpacts.push({
      type: 'Bank Balance',
      description: `Bank balance will be ${br.transactionType === 'INFLOW' ? 'reduced' : 'increased'} by $${amount}`,
      amount: br.transactionType === 'INFLOW' ? -amount : amount,
      severity: 'HIGH'
    });

    // Check for related transactions
    if (br.relatedDocumentType && br.relatedDocumentNumber) {
      cascadeImpacts.push({
        type: 'Related Transaction',
        description: `Related ${br.relatedDocumentType} ${br.relatedDocumentNumber} may need adjustment`,
        severity: 'MEDIUM'
      });
    }

    const riskLevel = this.calculateRiskLevel(amount, directImpacts.length + cascadeImpacts.length);
    const requiredApprovals = this.determineRequiredApprovals(amount, riskLevel, 'BankRegister');

    return {
      entityType: 'BankRegister',
      entityId: brId,
      entityData: br.toJSON(),
      directImpacts,
      cascadeImpacts,
      financialImpact,
      riskLevel,
      requiredApprovals,
      estimatedReversalTime: this.calculateReversalTime(directImpacts.length + cascadeImpacts.length),
      complianceNotes: this.generateComplianceNotes('BankRegister', amount, riskLevel)
    };
  }

  /**
   * Analyze Cash Register Deletion Impact
   */
  private async analyzeCashRegisterDeletion(crId: number): Promise<TransactionImpactAnalysis> {
    const cr = await CashRegister.findByPk(crId);
    
    if (!cr) {
      throw new NotFoundError(`Cash Register with ID ${crId} not found`);
    }

    const directImpacts: ImpactItem[] = [];
    const cascadeImpacts: ImpactItem[] = [];
    const amount = parseFloat(cr.amount.toString());
    
    const financialImpact: FinancialImpact = {
      cashFlow: cr.transactionType === 'INFLOW' ? -amount : amount,
      accountsReceivable: 0,
      accountsPayable: 0,
      bankBalance: 0,
      cashRegisterBalance: cr.transactionType === 'INFLOW' ? -amount : amount
    };

    directImpacts.push({
      type: 'Cash Register Balance',
      description: `Cash register balance will be ${cr.transactionType === 'INFLOW' ? 'reduced' : 'increased'} by $${amount}`,
      amount: cr.transactionType === 'INFLOW' ? -amount : amount,
      severity: 'MEDIUM'
    });

    // Check for bank deposit impact
    if (cr.bankAccountId) {
      cascadeImpacts.push({
        type: 'Bank Deposit',
        description: `Related bank deposit may need reversal`,
        severity: 'HIGH'
      });
    }

    const riskLevel = this.calculateRiskLevel(amount, directImpacts.length + cascadeImpacts.length);
    const requiredApprovals = this.determineRequiredApprovals(amount, riskLevel, 'CashRegister');

    return {
      entityType: 'CashRegister',
      entityId: crId,
      entityData: cr.toJSON(),
      directImpacts,
      cascadeImpacts,
      financialImpact,
      riskLevel,
      requiredApprovals,
      estimatedReversalTime: this.calculateReversalTime(directImpacts.length + cascadeImpacts.length),
      complianceNotes: this.generateComplianceNotes('CashRegister', amount, riskLevel)
    };
  }

  /**
   * Calculate risk level based on amount and impact count
   */
  private calculateRiskLevel(amount: number, impactCount: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (amount > 50000 || impactCount > 5) return 'CRITICAL';
    if (amount > 10000 || impactCount > 3) return 'HIGH';
    if (amount > 1000 || impactCount > 1) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Determine required approvals based on amount, risk level, and entity type
   * ✅ PROFESSIONAL FIX: Returns only ONE approval level (highest needed)
   * One person = One approval (not multiple approvals from same person)
   */
  private determineRequiredApprovals(amount: number, riskLevel: string, entityType: string): string[] {
    // Determine the HIGHEST approval level needed
    let requiredLevel = 'Manager'; // Default minimum

    // Amount-based approval level (highest wins)
    if (amount > 50000 || riskLevel === 'CRITICAL') {
      requiredLevel = 'Board';
    } else if (amount > 10000 || riskLevel === 'HIGH') {
      requiredLevel = 'CFO';
    } else if (amount > 1000 || riskLevel === 'MEDIUM') {
      requiredLevel = 'Controller';
    }

    // Entity-specific overrides (if higher authority needed)
    if (entityType === 'Payment' && amount > 5000) {
      // If payment > $5,000, need at least CFO
      if (requiredLevel === 'Manager' || requiredLevel === 'Controller') {
        requiredLevel = 'CFO';
      }
    }

    // ✅ Return only ONE approval level (not multiple)
    return [requiredLevel];
  }

  /**
   * Calculate estimated reversal time in minutes
   */
  private calculateReversalTime(impactCount: number): number {
    // Base time: 5 minutes
    // Additional time per impact: 2 minutes
    return 5 + (impactCount * 2);
  }

  /**
   * Generate compliance notes based on entity type and risk level
   */
  private generateComplianceNotes(entityType: string, amount: number, riskLevel: string): string[] {
    const notes: string[] = [];

    notes.push('This deletion will create reversal entries to maintain audit trail compliance');
    notes.push('All related records will be updated to reflect the cancellation');
    
    if (amount > 10000) {
      notes.push('SOX compliance requires CFO approval for material transactions');
    }

    if (riskLevel === 'CRITICAL') {
      notes.push('High-risk deletion requires Board-level approval and detailed documentation');
    }

    if (entityType === 'Payment') {
      notes.push('Payment reversals must maintain complete audit trail for tax compliance');
    }

    notes.push('Complete transaction history will be preserved for regulatory requirements');

    return notes;
  }
}

export default TransactionImpactAnalysisService;