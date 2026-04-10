/**
 * COMPREHENSIVE MODEL REGISTRY
 * This file automatically imports ALL models and ensures complete database sync
 * 
 * CRITICAL: This prevents missing tables in production
 */

import sequelize from '../config/database';

// ===== CORE BUSINESS MODELS =====
import AccountsPayable from './AccountsPayable';
import AccountsReceivable from './AccountsReceivable';
import Adjustment from './Adjustment';
import AssociatedInvoice from './AssociatedInvoice';
import BankAccount from './BankAccount';
import BankRegister from './BankRegister';
import BusinessExpense from './BusinessExpense';
import BusinessExpenseAssociatedCost from './BusinessExpenseAssociatedCost';
import Card from './Card';
import CardPaymentNetwork from './CardPaymentNetwork';
import CashRegister from './CashRegister';
import CashRegisterMaster from './CashRegisterMaster';
import Client from './Client';
import ClientCredit from './ClientCredit';
import ClientPaymentMethod from './ClientPaymentMethod';
import CreditBalance from './CreditBalance';
import CreditCardFee from './CreditCardFee';
import CreditCardNetwork from './CreditCardNetwork';
import CreditCardRegister from './CreditCardRegister';
import DataClassificationMetadata from './DataClassificationMetadata';
import Expense from './Expense';
import ExpenseCategory from './ExpenseCategory';
import ExpenseType from './ExpenseType';
import Financer from './Financer';
import FixedAsset from './FixedAsset';
import Investment from './Investment';
import InvestmentAgreement from './InvestmentAgreement';
import Payment from './Payment';
import PaymentInvoiceApplication from './PaymentInvoiceApplication';
import PrepaidExpense from './PrepaidExpense';
import Product from './Product';
import ProductPrice from './ProductPrice';
import Purchase from './Purchase';
import PurchaseItem from './PurchaseItem';
import Sale from './Sale';
import SaleItem from './SaleItem';
import Supplier from './Supplier';
import SupplierCredit from './SupplierCredit';

// ===== APPROVAL & WORKFLOW MODELS =====
import ApprovalRequest from './ApprovalRequest';
import ApprovalStep from './ApprovalStep';
import TransactionAuditTrail from './TransactionAuditTrail';
import TransactionDeletionReason from './TransactionDeletionReason';

// ===== USER & AUTH MODELS =====
import User from './User';
import UserRole from './UserRole';

// ===== ACCOUNTING MODELS (DOUBLE-ENTRY) =====
import ChartOfAccounts from './accounting/ChartOfAccounts';
import GeneralLedger from './accounting/GeneralLedger';
import AccountBalance from './accounting/AccountBalance';
import FiscalPeriod from './accounting/FiscalPeriod';

/**
 * COMPLETE MODEL REGISTRY
 * Every model MUST be listed here to ensure table creation
 */
export const ALL_MODELS = {
  // Core Business
  AccountsPayable,
  AccountsReceivable,
  Adjustment,
  AssociatedInvoice,
  BankAccount,
  BankRegister,
  BusinessExpense,
  BusinessExpenseAssociatedCost,
  Card,
  CardPaymentNetwork,
  CashRegister,
  CashRegisterMaster,
  Client,
  ClientCredit,
  ClientPaymentMethod,
  CreditBalance,
  CreditCardFee,
  CreditCardNetwork,
  CreditCardRegister,
  DataClassificationMetadata,
  Expense,
  ExpenseCategory,
  ExpenseType,
  Financer,
  FixedAsset,
  Investment,
  InvestmentAgreement,
  Payment,
  PaymentInvoiceApplication,
  PrepaidExpense,
  Product,
  ProductPrice,
  Purchase,
  PurchaseItem,
  Sale,
  SaleItem,
  Supplier,
  SupplierCredit,
  
  // Approval & Workflow
  ApprovalRequest,
  ApprovalStep,
  TransactionAuditTrail,
  TransactionDeletionReason,
  
  // User & Auth
  User,
  UserRole,
  
  // Accounting (Double-Entry)
  ChartOfAccounts,
  GeneralLedger,
  AccountBalance,
  FiscalPeriod,
};

/**
 * SETUP ALL ASSOCIATIONS
 * Import all association files to ensure relationships are established
 */
export function setupAssociations() {
  console.log('🔗 Setting up model associations...');
  
  // Import main associations
  require('./associations');
  
  // Import business expense associations
  require('./businessExpenseAssociations');
  
  // Import accounting associations
  require('./accounting/associations');
  
  console.log('✅ All associations loaded');
}

/**
 * FORCE SYNC ALL MODELS
 * Ensures every single model creates its table
 */
export async function syncAllModels(options: { force?: boolean; alter?: boolean } = {}) {
  console.log('🏗️ Syncing all models to database...');
  
  const modelNames = Object.keys(ALL_MODELS);
  console.log(`📊 Total models to sync: ${modelNames.length}`);
  
  // Setup associations first
  setupAssociations();
  
  // Sync all models
  await sequelize.sync({
    force: options.force || false,
    alter: options.alter || false,
    logging: console.log
  });
  
  console.log('✅ All models synced successfully');
  
  // Verify all tables exist
  await verifyAllTables();
}

/**
 * VERIFY ALL TABLES EXIST
 * Checks that every model has created its table
 */
export async function verifyAllTables() {
  console.log('🔍 Verifying all tables exist...');
  
  const modelNames = Object.keys(ALL_MODELS);
  const missingTables: string[] = [];
  const existingTables: string[] = [];
  
  for (const modelName of modelNames) {
    const model = ALL_MODELS[modelName as keyof typeof ALL_MODELS];
    const tableName = model.tableName;
    
    try {
      await sequelize.query(`SELECT 1 FROM ${tableName} LIMIT 1`);
      existingTables.push(tableName);
      console.log(`✅ ${tableName}`);
    } catch (error) {
      missingTables.push(tableName);
      console.log(`❌ ${tableName} - MISSING`);
    }
  }
  
  console.log(`\n📊 Table Verification Results:`);
  console.log(`✅ Existing: ${existingTables.length}/${modelNames.length}`);
  console.log(`❌ Missing: ${missingTables.length}/${modelNames.length}`);
  
  if (missingTables.length > 0) {
    console.log(`\n🚨 Missing Tables:`);
    missingTables.forEach(table => console.log(`   - ${table}`));
    throw new Error(`${missingTables.length} tables are missing from database`);
  }
  
  console.log('🎉 All tables verified successfully!');
}

/**
 * GET MODEL COUNT
 * Returns the total number of registered models
 */
export function getModelCount(): number {
  return Object.keys(ALL_MODELS).length;
}

// Export individual models for backward compatibility
export {
  AccountsPayable,
  AccountsReceivable,
  Adjustment,
  ApprovalRequest,
  ApprovalStep,
  AssociatedInvoice,
  BankAccount,
  BankRegister,
  BusinessExpense,
  BusinessExpenseAssociatedCost,
  Card,
  CardPaymentNetwork,
  CashRegister,
  CashRegisterMaster,
  Client,
  ClientCredit,
  ClientPaymentMethod,
  CreditBalance,
  CreditCardFee,
  CreditCardNetwork,
  CreditCardRegister,
  DataClassificationMetadata,
  Expense,
  ExpenseCategory,
  ExpenseType,
  Financer,
  FixedAsset,
  Investment,
  InvestmentAgreement,
  Payment,
  PaymentInvoiceApplication,
  PrepaidExpense,
  Product,
  ProductPrice,
  Purchase,
  PurchaseItem,
  Sale,
  SaleItem,
  Supplier,
  SupplierCredit,
  TransactionAuditTrail,
  TransactionDeletionReason,
  User,
  UserRole,
  ChartOfAccounts,
  GeneralLedger,
  AccountBalance,
  FiscalPeriod,
};

export default ALL_MODELS;