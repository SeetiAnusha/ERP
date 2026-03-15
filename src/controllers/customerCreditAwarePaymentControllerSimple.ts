// Simple controller for testing
import { Request, Response } from 'express';
import * as customerCreditAwarePaymentServiceSimple from '../services/customerCreditAwarePaymentServiceSimple';

export const processCustomerCreditAwarePaymentSimple = async (req: Request, res: Response) => {
  try {
    console.log('🎯 Simple customer credit-aware payment controller called');
    const result = await customerCreditAwarePaymentServiceSimple.processCustomerCreditAwarePaymentSimple(req.body);
    res.json(result);
  } catch (error) {
    console.error('❌ Error in simple customer credit-aware payment controller:', error);
    res.status(500).json({
      success: false,
      creditUsed: 0,
      cashPaymentMade: 0,
      totalPaymentProcessed: 0,
      remainingInvoiceBalance: 0,
      message: `Controller error: ${error instanceof Error ? error.message : String(error)}`
    });
  }
};