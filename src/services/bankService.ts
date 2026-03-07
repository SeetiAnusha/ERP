import CashRegister from '../models/CashRegister';
import Financer from '../models/Financer';
import CashRegisterMaster from '../models/CashRegisterMaster';
import { Op } from 'sequelize';

// Get all banks with their loan details
export const getAllBanks = async () => {
  try {
    // Get all LOAN transactions from CashRegister
    const loanTransactions = await CashRegister.findAll({
      where: {
        relatedDocumentType: 'LOAN'
      },
      order: [['registrationDate', 'DESC']]
    });

    // Get all investment agreements for loans
    const InvestmentAgreement = require('../models/InvestmentAgreement').default;
    const loanAgreements = await InvestmentAgreement.findAll({
      where: {
        agreementType: 'LOAN'
      }
    });

    // TEMPORARY: Also get AccountsPayable for existing data (fallback)
    const AccountsPayable = require('../models/AccountsPayable').default;
    const loanAP = await AccountsPayable.findAll({
      where: {
        type: 'LOAN'
      }
    });

    // Get all bank financers
    const banks = await Financer.findAll({
      where: { 
        type: {
          [Op.in]: ['BANK', 'OTHER'] // Include OTHER for private lenders
        },
        status: 'ACTIVE'
      }
    });

    // Get all cash register masters for store info
    const cashRegisterMasters = await CashRegisterMaster.findAll({
      where: { status: 'ACTIVE' }
    });

    // Process bank data
    const bankData = banks.map(bank => {
      // Find all loan agreements for this bank
      const bankAgreements = loanAgreements.filter((agreement: any) => agreement.investorId === bank.id);
      
      let totalLoaned = 0;
      let outstandingDebt = 0;
      const loans: any[] = [];

      // Method 1: Use Investment Agreements + Cash Register (new method)
      bankAgreements.forEach((agreement: any) => {
        // Add agreement totals
        totalLoaned += parseFloat(agreement.totalCommittedAmount.toString());
        outstandingDebt += parseFloat(agreement.balanceAmount.toString());

        // Find cash register transactions for this loan agreement
        const agreementTransactions = loanTransactions.filter(t => 
          t.investmentAgreementId === agreement.id
        );

        agreementTransactions.forEach((cashTransaction: any) => {
          // Find store details
          const store = cashRegisterMasters.find(s => s.id === cashTransaction.cashRegisterId);
          
          if (store) {
            loans.push({
              id: cashTransaction.id,
              amount: parseFloat(cashTransaction.amount.toString()),
              paidAmount: parseFloat(cashTransaction.amount.toString()),
              date: cashTransaction.registrationDate,
              storeName: store.name,
              storeLocation: store.location,
              registrationNumber: cashTransaction.registrationNumber,
              status: 'Paid',
              notes: cashTransaction.description,
              type: 'LOAN',
              agreementId: agreement.id,
              agreementNumber: agreement.agreementNumber,
              interestRate: agreement.interestRate,
              maturityDate: agreement.maturityDate
            });
          }
        });
      });

      // Method 2: FALLBACK - Use AccountsPayable for existing data
      const AccountsPayable = require('../models/AccountsPayable').default;
      const bankAP = loanAP.filter((ap: any) => ap.supplierId === bank.id);
      
      // If no data from new method, use old method
      if (loans.length === 0 && bankAP.length > 0) {
        bankAP.forEach((ap: any) => {
          totalLoaned += parseFloat(ap.amount.toString());
          outstandingDebt += parseFloat(ap.balanceAmount.toString());

          // Find corresponding cash register transaction
          const cashTransaction = loanTransactions.find((t: any) => 
            t.registrationNumber === ap.relatedDocumentNumber
          );

          if (cashTransaction) {
            // Find store details
            const store = cashRegisterMasters.find(s => s.id === cashTransaction.cashRegisterId);
            
            if (store) {
              loans.push({
                id: ap.id,
                amount: parseFloat(ap.amount.toString()),
                paidAmount: parseFloat(ap.paidAmount.toString()),
                date: ap.registrationDate,
                storeName: store.name,
                storeLocation: store.location,
                registrationNumber: ap.registrationNumber,
                status: ap.status,
                notes: ap.notes || cashTransaction.description,
                type: 'LOAN',
                agreementId: null,
                agreementNumber: 'Legacy',
                interestRate: null,
                maturityDate: null
              });
            }
          }
        });
      }

      // Group loans by store
      const storeMap = new Map();
      loans.forEach(loan => {
        const key = loan.storeName;
        if (!storeMap.has(key)) {
          storeMap.set(key, {
            storeName: loan.storeName,
            storeLocation: loan.storeLocation,
            totalAmount: 0,
            transactionCount: 0,
            lastDate: null,
            transactions: []
          });
        }
        const storeData = storeMap.get(key);
        storeData.totalAmount += loan.amount;
        storeData.transactionCount += 1;
        storeData.transactions.push(loan);
        
        if (!storeData.lastDate || new Date(loan.date) > new Date(storeData.lastDate)) {
          storeData.lastDate = loan.date;
        }
      });

      return {
        id: bank.id,
        code: bank.code,
        name: bank.name,
        type: bank.type,
        contactPerson: bank.contactPerson,
        phone: bank.phone,
        email: bank.email,
        totalLoaned,
        outstandingDebt,
        storesCount: storeMap.size,
        lastLoan: loans.length > 0 ? 
          loans.reduce((latest, loan) => 
            new Date(loan.date) > new Date(latest.date) ? loan : latest
          ).date : null,
        storeBreakdown: Array.from(storeMap.values()).map(store => ({
          ...store,
          percentage: totalLoaned > 0 ? (store.totalAmount / totalLoaned) * 100 : 0
        })),
        allLoans: loans.sort((a, b) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        )
      };
    });

    return bankData.sort((a, b) => b.totalLoaned - a.totalLoaned);
  } catch (error: any) {
    throw new Error(`Error getting banks: ${error.message}`);
  }
};

// Get specific bank details
export const getBankById = async (bankId: number) => {
  try {
    const bank = await Financer.findByPk(bankId);
    if (!bank || (bank.type !== 'BANK' && bank.type !== 'OTHER')) {
      throw new Error('Bank not found');
    }

    const transactions = [];

    // Method 1: Try new system (Investment Agreements)
    const InvestmentAgreement = require('../models/InvestmentAgreement').default;
    const agreements = await InvestmentAgreement.findAll({
      where: {
        investorId: bankId,
        agreementType: 'LOAN'
      },
      order: [['agreementDate', 'DESC']]
    });

    // Get cash register transactions for these agreements
    for (const agreement of agreements) {
      const cashTransactions = await CashRegister.findAll({
        where: { 
          investmentAgreementId: agreement.id,
          relatedDocumentType: 'LOAN'
        }
      });

      for (const cashTransaction of cashTransactions) {
        const store = await CashRegisterMaster.findByPk(cashTransaction.cashRegisterId);
        transactions.push({
          agreement: agreement.toJSON(),
          cashTransaction: cashTransaction.toJSON(),
          store: store?.toJSON()
        });
      }
    }

    // Method 2: Fallback to AccountsPayable if no new data
    if (transactions.length === 0) {
      const AccountsPayable = require('../models/AccountsPayable').default;
      const apEntries = await AccountsPayable.findAll({
        where: {
          supplierId: bankId,
          type: 'LOAN'
        },
        order: [['registrationDate', 'DESC']]
      });

      for (const ap of apEntries) {
        const cashTransaction = await CashRegister.findOne({
          where: { registrationNumber: ap.relatedDocumentNumber }
        });

        if (cashTransaction) {
          const store = await CashRegisterMaster.findByPk(cashTransaction.cashRegisterId);
          transactions.push({
            accountsPayable: ap.toJSON(),
            cashTransaction: cashTransaction.toJSON(),
            store: store?.toJSON()
          });
        }
      }
    }

    return {
      bank: bank.toJSON(),
      loans: transactions
    };
  } catch (error: any) {
    throw new Error(`Error getting bank details: ${error.message}`);
  }
};

// Get bank summary statistics
export const getBankSummary = async () => {
  try {
    const banks = await getAllBanks();
    
    const totalBanks = banks.length;
    const totalLoaned = banks.reduce((sum, bank) => sum + bank.totalLoaned, 0);
    const totalOutstanding = banks.reduce((sum, bank) => sum + bank.outstandingDebt, 0);
    const averageLoan = totalBanks > 0 ? totalLoaned / totalBanks : 0;

    // Top bank
    const topBank = banks.length > 0 ? banks[0] : null;

    // Recent loans (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentLoans = banks.flatMap(bank => 
      bank.allLoans.filter(loan => 
        new Date(loan.date) >= thirtyDaysAgo
      )
    );

    // Separate by type
    const actualBanks = banks.filter(b => b.type === 'BANK');
    const privateLenders = banks.filter(b => b.type === 'OTHER');

    return {
      totalBanks,
      totalLoaned,
      totalOutstanding,
      averageLoan,
      topBank,
      recentLoansCount: recentLoans.length,
      recentLoansAmount: recentLoans.reduce((sum, loan) => sum + loan.amount, 0),
      bankCount: actualBanks.length,
      privateLenderCount: privateLenders.length,
      bankAmount: actualBanks.reduce((sum, bank) => sum + bank.totalLoaned, 0),
      privateLenderAmount: privateLenders.reduce((sum, lender) => sum + lender.totalLoaned, 0)
    };
  } catch (error: any) {
    throw new Error(`Error getting bank summary: ${error.message}`);
  }
};