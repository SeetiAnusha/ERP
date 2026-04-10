/**
 * Accounting Models Associations
 * 
 * Defines relationships between accounting models
 */

import ChartOfAccounts from './ChartOfAccounts';
import GeneralLedger from './GeneralLedger';
import AccountBalance from './AccountBalance';
import FiscalPeriod from './FiscalPeriod';
import AccountClassification from './AccountClassification';
import User from '../User';

// ChartOfAccounts associations
ChartOfAccounts.hasMany(ChartOfAccounts, {
  foreignKey: 'parentAccountId',
  as: 'subAccounts',
});

ChartOfAccounts.belongsTo(ChartOfAccounts, {
  foreignKey: 'parentAccountId',
  as: 'parentAccount',
});

ChartOfAccounts.hasMany(GeneralLedger, {
  foreignKey: 'accountId',
  as: 'ledgerEntries',
});

ChartOfAccounts.hasMany(AccountBalance, {
  foreignKey: 'accountId',
  as: 'balances',
});

ChartOfAccounts.hasOne(AccountClassification, {
  foreignKey: 'accountId',
  as: 'classification',
});

// GeneralLedger associations
GeneralLedger.belongsTo(ChartOfAccounts, {
  foreignKey: 'accountId',
  as: 'account',
});

GeneralLedger.belongsTo(FiscalPeriod, {
  foreignKey: 'fiscalPeriodId',
  as: 'fiscalPeriod',
});

GeneralLedger.belongsTo(User, {
  foreignKey: 'createdBy',
  as: 'creator',
});

GeneralLedger.belongsTo(User, {
  foreignKey: 'postedBy',
  as: 'poster',
});

// AccountBalance associations
AccountBalance.belongsTo(ChartOfAccounts, {
  foreignKey: 'accountId',
  as: 'account',
});

AccountBalance.belongsTo(FiscalPeriod, {
  foreignKey: 'fiscalPeriodId',
  as: 'fiscalPeriod',
});

// FiscalPeriod associations
FiscalPeriod.hasMany(GeneralLedger, {
  foreignKey: 'fiscalPeriodId',
  as: 'ledgerEntries',
});

FiscalPeriod.hasMany(AccountBalance, {
  foreignKey: 'fiscalPeriodId',
  as: 'accountBalances',
});

FiscalPeriod.belongsTo(User, {
  foreignKey: 'closedBy',
  as: 'closer',
});

// AccountClassification associations
AccountClassification.belongsTo(ChartOfAccounts, {
  foreignKey: 'accountId',
  as: 'account',
});

export default {
  ChartOfAccounts,
  GeneralLedger,
  AccountBalance,
  FiscalPeriod,
  AccountClassification,
};
