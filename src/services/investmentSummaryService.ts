import CashRegister from '../models/CashRegister';
import AccountsPayable from '../models/AccountsPayable';
import Financer from '../models/Financer';
import CashRegisterMaster from '../models/CashRegisterMaster';
import { Op } from 'sequelize';

// Get comprehensive investment and loan summary
export const getInvestmentSummary = async () => {
  try {
    // Get all CONTRIBUTION and LOAN transactions
    const investmentTransactions = await CashRegister.findAll({
      where: {
        relatedDocumentType: {
          [Op.in]: ['CONTRIBUTION', 'LOAN']
        }
      },
      order: [['registrationDate', 'DESC']]
    });

    // Get corresponding Accounts Payable entries
    const apEntries = await AccountsPayable.findAll({
      where: {
        type: {
          [Op.in]: ['CONTRIBUTION', 'LOAN']
        }
      }
    });

    // Get all financers
    const financers = await Financer.findAll({
      where: { status: 'ACTIVE' }
    });

    // Get all cash register masters
    const cashRegisterMasters = await CashRegisterMaster.findAll({
      where: { status: 'ACTIVE' }
    });

    // Process data for summary
    const investors = await processInvestors(investmentTransactions, apEntries, financers, cashRegisterMasters);
    const banks = await processBanks(investmentTransactions, apEntries, financers, cashRegisterMasters);
    const stores = await processStores(investmentTransactions, apEntries, financers, cashRegisterMasters);
    const recentActivity = await processRecentActivity(investmentTransactions, apEntries, financers, cashRegisterMasters);

    return {
      investors,
      banks,
      stores,
      recentActivity
    };
  } catch (error: any) {
    throw new Error(`Error getting investment summary: ${error.message}`);
  }
};

// Process investors (CONTRIBUTION only)
const processInvestors = async (transactions: any[], apEntries: any[], financers: any[], cashRegisterMasters: any[]) => {
  const investorMap = new Map();

  // Filter for CONTRIBUTION only
  const contributionTransactions = transactions.filter(t => t.relatedDocumentType === 'CONTRIBUTION');
  const contributionAP = apEntries.filter(ap => ap.type === 'CONTRIBUTION');

  // Process each AP entry
  for (const ap of contributionAP) {
    const financer = financers.find(f => f.id === ap.supplierId && f.type === 'INVESTOR');
    if (!financer) continue;

    // Find corresponding cash register transaction
    const cashTransaction = contributionTransactions.find(t => t.registrationNumber === ap.relatedDocumentNumber);
    if (!cashTransaction) continue;

    // Find store details
    const store = cashRegisterMasters.find(s => s.id === cashTransaction.cashRegisterId);
    if (!store) continue;

    // Initialize investor if not exists
    if (!investorMap.has(financer.id)) {
      investorMap.set(financer.id, {
        id: financer.id,
        name: financer.name,
        code: financer.code,
        type: financer.type,
        totalInvested: 0,
        storesCount: 0,
        lastInvestment: null,
        outstandingDebt: 0,
        investments: []
      });
    }

    const investor = investorMap.get(financer.id);
    const amount = parseFloat(ap.amount.toString());
    
    investor.totalInvested += amount;
    investor.outstandingDebt += parseFloat(ap.balanceAmount.toString());

    // Update last investment date
    if (!investor.lastInvestment || new Date(ap.registrationDate) > new Date(investor.lastInvestment)) {
      investor.lastInvestment = ap.registrationDate;
    }

    // Add to investments array
    investor.investments.push({
      storeId: store.id,
      storeName: store.name,
      storeLocation: store.location,
      amount: amount,
      transactionCount: 1,
      lastDate: ap.registrationDate
    });
  }

  // Convert to array and group by store
  return Array.from(investorMap.values()).map(investor => {
    // Group investments by store
    const storeMap = new Map();
    investor.investments.forEach((inv: any) => {
      if (!storeMap.has(inv.storeId)) {
        storeMap.set(inv.storeId, {
          storeId: inv.storeId,
          storeName: inv.storeName,
          storeLocation: inv.storeLocation,
          amount: 0,
          transactionCount: 0,
          lastDate: null
        });
      }
      const storeData = storeMap.get(inv.storeId);
      storeData.amount += inv.amount;
      storeData.transactionCount += 1;
      if (!storeData.lastDate || new Date(inv.lastDate) > new Date(storeData.lastDate)) {
        storeData.lastDate = inv.lastDate;
      }
    });

    return {
      ...investor,
      storesCount: storeMap.size,
      investments: Array.from(storeMap.values()).map((store: any) => ({
        ...store,
        percentage: (store.amount / investor.totalInvested) * 100
      }))
    };
  });
};

// Process banks (LOAN only)
const processBanks = async (transactions: any[], apEntries: any[], financers: any[], cashRegisterMasters: any[]) => {
  const bankMap = new Map();

  // Filter for LOAN only
  const loanTransactions = transactions.filter(t => t.relatedDocumentType === 'LOAN');
  const loanAP = apEntries.filter(ap => ap.type === 'LOAN');

  // Process each AP entry
  for (const ap of loanAP) {
    const financer = financers.find(f => f.id === ap.supplierId && f.type === 'BANK');
    if (!financer) continue;

    // Find corresponding cash register transaction
    const cashTransaction = loanTransactions.find(t => t.registrationNumber === ap.relatedDocumentNumber);
    if (!cashTransaction) continue;

    // Find store details
    const store = cashRegisterMasters.find(s => s.id === cashTransaction.cashRegisterId);
    if (!store) continue;

    // Initialize bank if not exists
    if (!bankMap.has(financer.id)) {
      bankMap.set(financer.id, {
        id: financer.id,
        name: financer.name,
        code: financer.code,
        type: financer.type,
        totalLoaned: 0,
        storesCount: 0,
        lastLoan: null,
        outstandingDebt: 0,
        loans: []
      });
    }

    const bank = bankMap.get(financer.id);
    const amount = parseFloat(ap.amount.toString());
    
    bank.totalLoaned += amount;
    bank.outstandingDebt += parseFloat(ap.balanceAmount.toString());

    // Update last loan date
    if (!bank.lastLoan || new Date(ap.registrationDate) > new Date(bank.lastLoan)) {
      bank.lastLoan = ap.registrationDate;
    }

    // Add to loans array
    bank.loans.push({
      storeId: store.id,
      storeName: store.name,
      storeLocation: store.location,
      amount: amount,
      transactionCount: 1,
      lastDate: ap.registrationDate
    });
  }

  // Convert to array and group by store
  return Array.from(bankMap.values()).map(bank => {
    // Group loans by store
    const storeMap = new Map();
    bank.loans.forEach((loan: any) => {
      if (!storeMap.has(loan.storeId)) {
        storeMap.set(loan.storeId, {
          storeId: loan.storeId,
          storeName: loan.storeName,
          storeLocation: loan.storeLocation,
          amount: 0,
          transactionCount: 0,
          lastDate: null
        });
      }
      const storeData = storeMap.get(loan.storeId);
      storeData.amount += loan.amount;
      storeData.transactionCount += 1;
      if (!storeData.lastDate || new Date(loan.lastDate) > new Date(storeData.lastDate)) {
        storeData.lastDate = loan.lastDate;
      }
    });

    return {
      ...bank,
      storesCount: storeMap.size,
      loans: Array.from(storeMap.values()).map((store: any) => ({
        ...store,
        percentage: (store.amount / bank.totalLoaned) * 100
      }))
    };
  });
};

// Process stores
const processStores = async (transactions: any[], apEntries: any[], financers: any[], cashRegisterMasters: any[]) => {
  return cashRegisterMasters.map(store => {
    const storeTransactions = transactions.filter(t => t.cashRegisterId === store.id);
    
    let totalInvestments = 0;
    let totalLoans = 0;
    const investments: any[] = [];
    const loans: any[] = [];

    storeTransactions.forEach(transaction => {
      const ap = apEntries.find(ap => ap.relatedDocumentNumber === transaction.registrationNumber);
      if (!ap) return;

      const financer = financers.find(f => f.id === ap.supplierId);
      if (!financer) return;

      const amount = parseFloat(transaction.amount.toString());

      if (transaction.relatedDocumentType === 'CONTRIBUTION') {
        totalInvestments += amount;
        investments.push({
          financerId: financer.id,
          financerName: financer.name,
          amount: amount,
          transactionCount: 1
        });
      } else if (transaction.relatedDocumentType === 'LOAN') {
        totalLoans += amount;
        loans.push({
          financerId: financer.id,
          financerName: financer.name,
          amount: amount,
          transactionCount: 1
        });
      }
    });

    return {
      id: store.id,
      name: store.name,
      location: store.location,
      currentBalance: parseFloat(store.balance.toString()),
      totalInvestments,
      totalLoans,
      totalFinancing: totalInvestments + totalLoans,
      investments,
      loans
    };
  });
};

// Process recent activity
const processRecentActivity = async (transactions: any[], apEntries: any[], financers: any[], cashRegisterMasters: any[]) => {
  return transactions.slice(0, 10).map(transaction => {
    const ap = apEntries.find(ap => ap.relatedDocumentNumber === transaction.registrationNumber);
    const financer = ap ? financers.find(f => f.id === ap.supplierId) : null;
    const store = cashRegisterMasters.find(s => s.id === transaction.cashRegisterId);

    return {
      date: transaction.registrationDate,
      type: transaction.relatedDocumentType,
      financerName: financer?.name || 'Unknown',
      financerType: financer?.type || 'Unknown',
      storeName: store?.name || 'Unknown',
      storeLocation: store?.location || '',
      amount: parseFloat(transaction.amount.toString()),
      storeBalanceAfter: parseFloat(transaction.balance.toString()),
      registrationNumber: transaction.registrationNumber
    };
  });
};

// Get investment details by financer
export const getInvestmentByFinancer = async (financerId: number) => {
  try {
    const financer = await Financer.findByPk(financerId);
    if (!financer) {
      throw new Error('Financer not found');
    }

    const apEntries = await AccountsPayable.findAll({
      where: {
        supplierId: financerId,
        type: financer.type === 'INVESTOR' ? 'CONTRIBUTION' : 'LOAN'
      },
      order: [['registrationDate', 'DESC']]
    });

    const transactions = [];
    for (const ap of apEntries) {
      const cashTransaction = await CashRegister.findOne({
        where: { registrationNumber: ap.relatedDocumentNumber }
      });

      if (cashTransaction) {
        const store = await CashRegisterMaster.findByPk(cashTransaction.cashRegisterId);
        transactions.push({
          ...ap.toJSON(),
          cashTransaction: cashTransaction.toJSON(),
          store: store?.toJSON()
        });
      }
    }

    return {
      financer: financer.toJSON(),
      transactions
    };
  } catch (error: any) {
    throw new Error(`Error getting investment by financer: ${error.message}`);
  }
};

// Get investment details by store
export const getInvestmentByStore = async (cashRegisterId: number) => {
  try {
    const store = await CashRegisterMaster.findByPk(cashRegisterId);
    if (!store) {
      throw new Error('Store not found');
    }

    const transactions = await CashRegister.findAll({
      where: {
        cashRegisterId,
        relatedDocumentType: {
          [Op.in]: ['CONTRIBUTION', 'LOAN']
        }
      },
      order: [['registrationDate', 'DESC']]
    });

    const details = [];
    for (const transaction of transactions) {
      const apEntry = await AccountsPayable.findOne({
        where: { relatedDocumentNumber: transaction.registrationNumber }
      });

      if (apEntry) {
        const financer = await Financer.findByPk(apEntry.supplierId);
        details.push({
          ...transaction.toJSON(),
          accountsPayable: apEntry.toJSON(),
          financer: financer?.toJSON()
        });
      }
    }

    return {
      store: store.toJSON(),
      transactions: details
    };
  } catch (error: any) {
    throw new Error(`Error getting investment by store: ${error.message}`);
  }
};