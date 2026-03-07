import CashRegister from '../models/CashRegister';
import AccountsPayable from '../models/AccountsPayable';
import Financer from '../models/Financer';
import CashRegisterMaster from '../models/CashRegisterMaster';
import { Op } from 'sequelize';
import { fixInvestmentStatus } from '../scripts/fixInvestmentStatus';

// Get all investors with their investment and loan details
export const getAllInvestors = async () => {
  try {
    // Get all CONTRIBUTION and LOAN transactions
    const financialTransactions = await CashRegister.findAll({
      where: {
        relatedDocumentType: {
          [Op.in]: ['CONTRIBUTION', 'LOAN']
        }
      },
      order: [['registrationDate', 'DESC']]
    });

    // Get corresponding Accounts Payable entries for both types
    const financialAP = await AccountsPayable.findAll({
      where: {
        type: {
          [Op.in]: ['CONTRIBUTION', 'LOAN']
        }
      }
    });

    // Get all investor and bank financers (both can provide money)
    const financers = await Financer.findAll({
      where: { 
        type: {
          [Op.in]: ['INVESTOR', 'BANK', 'OTHER']
        },
        status: 'ACTIVE'
      }
    });

    // Get all cash register masters for store info
    const cashRegisterMasters = await CashRegisterMaster.findAll({
      where: { status: 'ACTIVE' }
    });

    // Process financer data (investors, banks, lenders)
    const financerData = financers.map(financer => {
      // Find all AP entries for this financer
      const financerAP = financialAP.filter(ap => ap.supplierId === financer.id);
      
      let totalProvided = 0;
      let outstandingDebt = 0;
      const transactions: any[] = [];

      financerAP.forEach(ap => {
        totalProvided += parseFloat(ap.amount.toString());
        outstandingDebt += parseFloat(ap.balanceAmount.toString());

        // Find corresponding cash register transaction
        const cashTransaction = financialTransactions.find(t => 
          t.registrationNumber === ap.relatedDocumentNumber
        );

        if (cashTransaction) {
          // Find store details
          const store = cashRegisterMasters.find(s => s.id === cashTransaction.cashRegisterId);
          
          if (store) {
            transactions.push({
              id: ap.id,
              amount: parseFloat(ap.amount.toString()),
              paidAmount: parseFloat(ap.paidAmount.toString()),
              date: ap.registrationDate,
              storeName: store.name,
              storeLocation: store.location,
              registrationNumber: ap.registrationNumber,
              status: ap.status,
              notes: ap.notes,
              type: ap.type, // CONTRIBUTION or LOAN
              transactionType: cashTransaction.relatedDocumentType
            });
          }
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
        type: financer.type, // INVESTOR, BANK, OTHER
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

// Get specific financer details (investor, bank, or lender)
export const getInvestorById = async (investorId: number) => {
  try {
    const financer = await Financer.findByPk(investorId);
    if (!financer) {
      throw new Error('Financer not found');
    }

    // Get all transactions for this financer (both CONTRIBUTION and LOAN)
    const apEntries = await AccountsPayable.findAll({
      where: {
        supplierId: investorId,
        type: {
          [Op.in]: ['CONTRIBUTION', 'LOAN']
        }
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
    throw new Error(`Error getting financer details: ${error.message}`);
  }
};

// Update investment payment status
export const updateInvestmentPaymentStatus = async (investmentId: number, paidAmount: number, status: string) => {
  try {
    const apEntry = await AccountsPayable.findByPk(investmentId);
    if (!apEntry) {
      throw new Error('Investment not found');
    }

    // Calculate new balance
    const newPaidAmount = parseFloat(paidAmount.toString());
    const totalAmount = parseFloat(apEntry.amount.toString());
    const newBalanceAmount = totalAmount - newPaidAmount;

    // Determine status based on payment
    let newStatus = status;
    if (newPaidAmount === 0) {
      newStatus = 'Pending';
    } else if (newPaidAmount >= totalAmount) {
      newStatus = 'Paid';
    } else {
      newStatus = 'Partial';
    }

    // Update the record
    await apEntry.update({
      paidAmount: newPaidAmount,
      balanceAmount: newBalanceAmount,
      status: newStatus,
      paidDate: newStatus === 'Paid' ? new Date() : undefined
    });

    return apEntry;
  } catch (error: any) {
    throw new Error(`Error updating payment status: ${error.message}`);
  }
};

// Mark investment as fully paid
export const markInvestmentAsPaid = async (investmentId: number) => {
  try {
    const apEntry = await AccountsPayable.findByPk(investmentId);
    if (!apEntry) {
      throw new Error('Investment not found');
    }

    const totalAmount = parseFloat(apEntry.amount.toString());
    
    await apEntry.update({
      paidAmount: totalAmount,
      balanceAmount: 0,
      status: 'Paid',
      paidDate: new Date()
    });

    return apEntry;
  } catch (error: any) {
    throw new Error(`Error marking investment as paid: ${error.message}`);
  }
};

// Get financer summary statistics (investors, banks, lenders)
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

    // Separate by type
    const investors = financers.filter(f => f.type === 'INVESTOR');
    const banks = financers.filter(f => f.type === 'BANK');
    const others = financers.filter(f => f.type === 'OTHER');

    return {
      totalFinancers,
      totalProvided,
      totalOutstanding,
      averageProvided,
      topFinancer,
      recentTransactionsCount: recentTransactions.length,
      recentTransactionsAmount: recentTransactions.reduce((sum, txn) => sum + txn.amount, 0),
      // Breakdown by type
      investorCount: investors.length,
      bankCount: banks.length,
      otherCount: others.length,
      investorAmount: investors.reduce((sum, inv) => sum + inv.totalProvided, 0),
      bankAmount: banks.reduce((sum, bank) => sum + bank.totalProvided, 0),
      otherAmount: others.reduce((sum, other) => sum + other.totalProvided, 0)
    };
  } catch (error: any) {
    throw new Error(`Error getting financer summary: ${error.message}`);
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