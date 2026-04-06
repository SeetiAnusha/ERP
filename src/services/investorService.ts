import CashRegister from '../models/CashRegister';
import BankRegister from '../models/BankRegister';
import Financer from '../models/Financer';
import CashRegisterMaster from '../models/CashRegisterMaster';
import BankAccount from '../models/BankAccount';
import InvestmentAgreement from '../models/InvestmentAgreement';
import { fixInvestmentStatus } from '../scripts/fixInvestmentStatus';

// Get all investors with their investment details (CONTRIBUTION from both Cash and Bank Register)
export const getAllInvestors = async () => {
  try {
    // Get all CONTRIBUTION transactions from Cash Register
    const contributionTransactionsCash = await CashRegister.findAll({
      where: {
        relatedDocumentType: 'CONTRIBUTION'
      },
      order: [['registrationDate', 'DESC']]
    });

    // ✅ NEW: Get all CONTRIBUTION transactions from Bank Register
    const contributionTransactionsBank = await BankRegister.findAll({
      where: {
        relatedDocumentType: 'CONTRIBUTION'
      },
      order: [['registrationDate', 'DESC']]
    });

    // Get all investor financers (only INVESTOR type)
    const financers = await Financer.findAll({
      where: { 
        type: 'INVESTOR',
        status: 'ACTIVE'
      }
    });

    // Get all cash register masters for store info
    const cashRegisterMasters = await CashRegisterMaster.findAll({
      where: { status: 'ACTIVE' }
    });

    // ✅ NEW: Get all bank accounts for bank info
    const bankAccounts = await BankAccount.findAll();

    // Get all investment agreements for investors
    const investmentAgreements = await InvestmentAgreement.findAll({
      where: {
        agreementType: 'INVESTMENT'
      }
    });

    // Process investor data (INVESTOR type only)
    const financerData = financers.map(financer => {
      // Find all investment agreements for this financer
      const financerAgreements = investmentAgreements.filter(agreement => agreement.investorId === financer.id);
      
      let totalProvided = 0;
      let outstandingDebt = 0;
      const transactions: any[] = [];

      // Process each investment agreement
      financerAgreements.forEach(agreement => {
        // Find all CASH register transactions for this agreement
        const agreementTransactionsCash = contributionTransactionsCash.filter(t => 
          t.investmentAgreementId === agreement.id
        );

        agreementTransactionsCash.forEach(cashTransaction => {
          const store = cashRegisterMasters.find(s => s.id === cashTransaction.cashRegisterId);
          
          if (store) {
            const amount = parseFloat(cashTransaction.amount.toString());
            totalProvided += amount;
            
            transactions.push({
              id: `cash-${cashTransaction.id}`,
              amount: amount,
              paidAmount: amount,
              date: cashTransaction.registrationDate,
              storeName: store.name,
              storeLocation: store.location,
              registrationNumber: cashTransaction.registrationNumber,
              status: 'Paid',
              notes: cashTransaction.description,
              type: 'CONTRIBUTION',
              transactionType: cashTransaction.relatedDocumentType,
              agreementNumber: agreement.agreementNumber,
              paymentMethod: cashTransaction.paymentMethod || 'CASH',
              source: 'Cash Register'
            });
          }
        });

        // ✅ NEW: Find all BANK register transactions for this agreement
        const agreementTransactionsBank = contributionTransactionsBank.filter(t => 
          (t as any).investmentAgreementId === agreement.id
        );

        agreementTransactionsBank.forEach(bankTransaction => {
          const bankAccount = bankAccounts.find(b => b.id === bankTransaction.bankAccountId);
          
          if (bankAccount) {
            const amount = parseFloat(bankTransaction.amount.toString());
            totalProvided += amount;
            
            transactions.push({
              id: `bank-${bankTransaction.id}`,
              amount: amount,
              paidAmount: amount,
              date: bankTransaction.registrationDate,
              storeName: `${bankAccount.bankName} - ${bankAccount.accountNumber}`,
              storeLocation: 'Bank Account',
              registrationNumber: bankTransaction.registrationNumber,
              status: 'Paid',
              notes: bankTransaction.description,
              type: 'CONTRIBUTION',
              transactionType: bankTransaction.relatedDocumentType,
              agreementNumber: agreement.agreementNumber,
              paymentMethod: bankTransaction.paymentMethod || 'BANK_TRANSFER',
              source: 'Bank Register'
            });
          }
        });

        // Outstanding debt is the remaining balance on the agreement
        outstandingDebt += parseFloat(agreement.balanceAmount.toString());
      });

      // ✅ ALSO include transactions WITHOUT investment agreement (legacy/orphaned transactions)
      const orphanedTransactionsCash = contributionTransactionsCash.filter(t => 
        !t.investmentAgreementId
      );

      orphanedTransactionsCash.forEach(cashTransaction => {
        if (transactions.some(t => t.id === `cash-${cashTransaction.id}`)) return;

        const store = cashRegisterMasters.find(s => s.id === cashTransaction.cashRegisterId);
        
        if (store) {
          const amount = parseFloat(cashTransaction.amount.toString());
          totalProvided += amount;
          
          transactions.push({
            id: `cash-${cashTransaction.id}`,
            amount: amount,
            paidAmount: amount,
            date: cashTransaction.registrationDate,
            storeName: store.name,
            storeLocation: store.location,
            registrationNumber: cashTransaction.registrationNumber,
            status: 'Paid',
            notes: cashTransaction.description || 'Legacy transaction (no agreement)',
            type: 'CONTRIBUTION',
            transactionType: cashTransaction.relatedDocumentType,
            agreementNumber: 'N/A',
            paymentMethod: cashTransaction.paymentMethod || 'CASH',
            source: 'Cash Register'
          });
        }
      });

      // ✅ NEW: Include orphaned bank register transactions
      const orphanedTransactionsBank = contributionTransactionsBank.filter(t => 
        !(t as any).investmentAgreementId
      );

      orphanedTransactionsBank.forEach(bankTransaction => {
        if (transactions.some(t => t.id === `bank-${bankTransaction.id}`)) return;

        const bankAccount = bankAccounts.find(b => b.id === bankTransaction.bankAccountId);
        
        if (bankAccount) {
          const amount = parseFloat(bankTransaction.amount.toString());
          totalProvided += amount;
          
          transactions.push({
            id: `bank-${bankTransaction.id}`,
            amount: amount,
            paidAmount: amount,
            date: bankTransaction.registrationDate,
            storeName: `${bankAccount.bankName} - ${bankAccount.accountNumber}`,
            storeLocation: 'Bank Account',
            registrationNumber: bankTransaction.registrationNumber,
            status: 'Paid',
            notes: bankTransaction.description || 'Legacy transaction (no agreement)',
            type: 'CONTRIBUTION',
            transactionType: bankTransaction.relatedDocumentType,
            agreementNumber: 'N/A',
            paymentMethod: bankTransaction.paymentMethod || 'BANK_TRANSFER',
            source: 'Bank Register'
          });
        }
      });

      // Group transactions by store
      const storeMap = new Map();
      transactions.forEach(txn => {
        const key = txn.storeName;
        if (!storeMap.has(key)) {
          storeMap.set(key, {
            storeName: txn.storeName,
            storeLocation: txn.storeLocation,
            totalAmount: 0,
            transactionCount: 0,
            lastDate: null,
            transactions: []
          });
        }
        const storeData = storeMap.get(key);
        storeData.totalAmount += txn.amount;
        storeData.transactionCount += 1;
        storeData.transactions.push(txn);
        
        if (!storeData.lastDate || new Date(txn.date) > new Date(storeData.lastDate)) {
          storeData.lastDate = txn.date;
        }
      });

      return {
        id: financer.id,
        code: financer.code,
        name: financer.name,
        type: financer.type, // INVESTOR only
        contactPerson: financer.contactPerson,
        phone: financer.phone,
        email: financer.email,
        totalProvided,
        outstandingDebt,
        storesCount: storeMap.size,
        lastTransaction: transactions.length > 0 ? 
          transactions.reduce((latest, txn) => 
            new Date(txn.date) > new Date(latest.date) ? txn : latest
          ).date : null,
        storeBreakdown: Array.from(storeMap.values()).map(store => ({
          ...store,
          percentage: totalProvided > 0 ? (store.totalAmount / totalProvided) * 100 : 0
        })),
        allTransactions: transactions.sort((a, b) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        )
      };
    });

    return financerData.sort((a, b) => b.totalProvided - a.totalProvided);
  } catch (error: any) {
    throw new Error(`Error getting investors: ${error.message}`);
  }
};

// Get specific investor details (CONTRIBUTION only)
export const getInvestorById = async (investorId: number) => {
  try {
    const financer = await Financer.findByPk(investorId);
    if (!financer || financer.type !== 'INVESTOR') {
      throw new Error('Investor not found');
    }

    // Get all investment agreements for this investor
    const agreements = await InvestmentAgreement.findAll({
      where: {
        investorId: investorId,
        agreementType: 'INVESTMENT' // Only INVESTMENT for investors
      },
      order: [['agreementDate', 'DESC']]
    });

    const transactions = [];
    for (const agreement of agreements) {
      // Get all cash register transactions for this agreement
      const cashTransactions = await CashRegister.findAll({
        where: { 
          investmentAgreementId: agreement.id,
          relatedDocumentType: 'CONTRIBUTION'
        }
      });

      for (const cashTransaction of cashTransactions) {
        const store = await CashRegisterMaster.findByPk(cashTransaction.cashRegisterId);
        transactions.push({
          id: cashTransaction.id,
          amount: parseFloat(cashTransaction.amount.toString()),
          paidAmount: parseFloat(cashTransaction.amount.toString()), // Cash transactions are immediately paid
          registrationDate: cashTransaction.registrationDate,
          registrationNumber: cashTransaction.registrationNumber,
          status: 'Paid', // Cash transactions are immediately paid
          notes: cashTransaction.description,
          type: 'CONTRIBUTION',
          cashTransaction: cashTransaction.toJSON(),
          store: store?.toJSON(),
          agreement: agreement.toJSON()
        });
      }
    }

    return {
      financer: financer.toJSON(),
      investments: transactions // Renamed from transactions to investments for clarity
    };
  } catch (error: any) {
    throw new Error(`Error getting investor details: ${error.message}`);
  }
};

// Update investment payment status (for manual corrections only)
export const updateInvestmentPaymentStatus = async (investmentId: number, paidAmount: number, status: string) => {
  try {
    // For cash register transactions, this is mainly for manual corrections
    // Since cash transactions are immediately "paid" when received
    const cashTransaction = await CashRegister.findByPk(investmentId);
    if (!cashTransaction) {
      throw new Error('Investment transaction not found');
    }

    // Note: For cash transactions, we don't typically update payment status
    // as they are immediately paid when received. This is for manual corrections only.
    console.log(`Manual correction requested for cash transaction ${cashTransaction.registrationNumber}`);
    
    return cashTransaction;
  } catch (error: any) {
    throw new Error(`Error updating payment status: ${error.message}`);
  }
};

// Mark investment as fully paid (for manual corrections only)
export const markInvestmentAsPaid = async (investmentId: number) => {
  try {
    // For cash register transactions, this is mainly for manual corrections
    // Since cash transactions are immediately "paid" when received
    const cashTransaction = await CashRegister.findByPk(investmentId);
    if (!cashTransaction) {
      throw new Error('Investment transaction not found');
    }

    // Note: For cash transactions, we don't typically update payment status
    // as they are immediately paid when received. This is for manual corrections only.
    console.log(`Manual mark as paid requested for cash transaction ${cashTransaction.registrationNumber}`);
    
    return cashTransaction;
  } catch (error: any) {
    throw new Error(`Error marking investment as paid: ${error.message}`);
  }
};

// Get investor summary statistics (INVESTOR type only)
export const getInvestorSummary = async () => {
  try {
    const financers = await getAllInvestors();
    
    const totalFinancers = financers.length;
    const totalProvided = financers.reduce((sum, fin) => sum + fin.totalProvided, 0);
    const totalOutstanding = financers.reduce((sum, fin) => sum + fin.outstandingDebt, 0);
    const averageProvided = totalFinancers > 0 ? totalProvided / totalFinancers : 0;

    // Top financer
    const topFinancer = financers.length > 0 ? financers[0] : null;

    // Recent transactions (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentTransactions = financers.flatMap(fin => 
      fin.allTransactions.filter(transaction => 
        new Date(transaction.date) >= thirtyDaysAgo
      )
    );

    // Separate by type (only investors now)
    const investors = financers.filter(f => f.type === 'INVESTOR');

    return {
      totalFinancers,
      totalProvided,
      totalOutstanding,
      averageProvided,
      topFinancer,
      recentTransactionsCount: recentTransactions.length,
      recentTransactionsAmount: recentTransactions.reduce((sum, txn) => sum + txn.amount, 0),
      // Breakdown by type (only investors)
      investorCount: investors.length,
      bankCount: 0, // No banks in investor service
      otherCount: 0, // No others in investor service
      investorAmount: investors.reduce((sum, inv) => sum + inv.totalProvided, 0),
      bankAmount: 0, // No banks in investor service
      otherAmount: 0 // No others in investor service
    };
  } catch (error: any) {
    throw new Error(`Error getting investor summary: ${error.message}`);
  }
};

// Fix investment status for existing data
export const fixExistingInvestmentStatus = async () => {
  try {
    return await fixInvestmentStatus();
  } catch (error: any) {
    throw new Error(`Error fixing investment status: ${error.message}`);
  }
};