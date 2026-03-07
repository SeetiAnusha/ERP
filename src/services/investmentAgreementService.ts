import InvestmentAgreement from '../models/InvestmentAgreement';
import Financer from '../models/Financer';
import { Op } from 'sequelize';
import sequelize from '../config/database';

// Create new investment/loan agreement
export const createInvestmentAgreement = async (data: any) => {
  const transaction = await sequelize.transaction();
  
  try {
    // Validate financer exists and has appropriate type for agreement
    const financer = await Financer.findByPk(data.investorId);
    if (!financer) {
      throw new Error('Financer not found');
    }

    // Validate financer type based on agreement type
    if (data.agreementType === 'INVESTMENT') {
      // For investments, allow INVESTOR type financers
      if (financer.type !== 'INVESTOR') {
        throw new Error('For investment agreements, please select an INVESTOR type financer');
      }
    } else if (data.agreementType === 'LOAN') {
      // For loans, allow BANK type financers (and optionally OTHER for private lenders)
      if (financer.type !== 'BANK' && financer.type !== 'OTHER') {
        throw new Error('For loan agreements, please select a BANK or OTHER type financer');
      }
    } else {
      throw new Error('Invalid agreement type');
    }

    // Generate agreement number
    const prefix = data.agreementType === 'INVESTMENT' ? 'INV' : 'LOAN';
    const lastAgreement = await InvestmentAgreement.findOne({
      where: {
        agreementNumber: {
          [Op.like]: `${prefix}%`
        }
      },
      order: [['id', 'DESC']]
    });
    
    let nextNumber = 1;
    if (lastAgreement) {
      const lastNumber = parseInt(lastAgreement.agreementNumber.substring(prefix.length));
      nextNumber = lastNumber + 1;
    }
    
    const agreementNumber = `${prefix}${String(nextNumber).padStart(4, '0')}`;
    
    const totalAmount = parseFloat(data.totalCommittedAmount);
    
    const agreement = await InvestmentAgreement.create({
      agreementNumber,
      agreementDate: data.agreementDate,
      investorId: data.investorId,
      investorName: financer.name,
      agreementType: data.agreementType,
      totalCommittedAmount: totalAmount,
      receivedAmount: 0,
      balanceAmount: totalAmount,
      interestRate: data.interestRate || null,
      maturityDate: data.maturityDate || null,
      status: 'ACTIVE',
      terms: data.terms || null,
      notes: data.notes || null,
    }, { transaction });

    await transaction.commit();
    return agreement;
    
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

// Get all investment agreements
export const getAllInvestmentAgreements = async () => {
  return await InvestmentAgreement.findAll({
    order: [['agreementDate', 'DESC']]
  });
};

// Get active agreements for cash register dropdown
export const getActiveAgreements = async () => {
  return await InvestmentAgreement.findAll({
    where: {
      status: 'ACTIVE',
      balanceAmount: {
        [Op.gt]: 0
      }
    },
    order: [['agreementDate', 'DESC']]
  });
};

// Get agreement by ID
export const getInvestmentAgreementById = async (id: number) => {
  return await InvestmentAgreement.findByPk(id);
};

// Update agreement when money is received
export const updateAgreementOnPayment = async (agreementId: number, receivedAmount: number) => {
  const transaction = await sequelize.transaction();
  
  try {
    const agreement = await InvestmentAgreement.findByPk(agreementId);
    if (!agreement) {
      throw new Error('Investment agreement not found');
    }

    const newReceivedAmount = parseFloat(agreement.receivedAmount.toString()) + receivedAmount;
    const newBalanceAmount = parseFloat(agreement.totalCommittedAmount.toString()) - newReceivedAmount;
    
    // Validate not exceeding committed amount
    if (newReceivedAmount > parseFloat(agreement.totalCommittedAmount.toString())) {
      throw new Error(
        `Cannot receive more than committed amount. ` +
        `Committed: ${agreement.totalCommittedAmount}, ` +
        `Already received: ${agreement.receivedAmount}, ` +
        `Trying to receive: ${receivedAmount}`
      );
    }

    // Update status if fully received
    const newStatus = newBalanceAmount <= 0 ? 'COMPLETED' : 'ACTIVE';

    await agreement.update({
      receivedAmount: newReceivedAmount,
      balanceAmount: newBalanceAmount,
      status: newStatus,
    }, { transaction });

    await transaction.commit();
    return agreement;
    
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

// Get agreements by investor
export const getAgreementsByInvestor = async (investorId: number) => {
  return await InvestmentAgreement.findAll({
    where: { investorId },
    order: [['agreementDate', 'DESC']]
  });
};

// Get agreement summary statistics
export const getAgreementSummary = async () => {
  const agreements = await InvestmentAgreement.findAll();
  
  const totalAgreements = agreements.length;
  const activeAgreements = agreements.filter(a => a.status === 'ACTIVE').length;
  const completedAgreements = agreements.filter(a => a.status === 'COMPLETED').length;
  
  const totalCommitted = agreements.reduce((sum, a) => sum + parseFloat(a.totalCommittedAmount.toString()), 0);
  const totalReceived = agreements.reduce((sum, a) => sum + parseFloat(a.receivedAmount.toString()), 0);
  const totalPending = agreements.reduce((sum, a) => sum + parseFloat(a.balanceAmount.toString()), 0);
  
  const investments = agreements.filter(a => a.agreementType === 'INVESTMENT');
  const loans = agreements.filter(a => a.agreementType === 'LOAN');
  
  return {
    totalAgreements,
    activeAgreements,
    completedAgreements,
    totalCommitted,
    totalReceived,
    totalPending,
    investmentCount: investments.length,
    loanCount: loans.length,
    investmentAmount: investments.reduce((sum, a) => sum + parseFloat(a.totalCommittedAmount.toString()), 0),
    loanAmount: loans.reduce((sum, a) => sum + parseFloat(a.totalCommittedAmount.toString()), 0),
  };
};