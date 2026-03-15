import { Request, Response } from 'express';
import * as creditAwarePaymentService from '../services/creditAwarePaymentService';

/**
 * Get payment preview - shows how credit balances will be applied
 */
export const getPaymentPreview = async (req: Request, res: Response) => {
  try {
    const { supplierId, invoiceIds, requestedAmount } = req.body;
    
    console.log('🔍 Getting payment preview for:', { supplierId, invoiceIds, requestedAmount });
    
    const preview = await creditAwarePaymentService.getPaymentPreview(
      supplierId,
      invoiceIds,
      requestedAmount
    );
    
    res.json(preview);
  } catch (error: any) {
    console.error('❌ Error getting payment preview:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Process credit-aware payment
 */
export const processPayment = async (req: Request, res: Response) => {
  try {
    console.log('🎯 Processing credit-aware payment...');
    console.log('📋 Request body:', JSON.stringify(req.body, null, 2));
    
    const result = await creditAwarePaymentService.processCreditAwarePayment(req.body);
    
    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error: any) {
    console.error('❌ Error processing credit-aware payment:', error);
    res.status(500).json({ error: error.message });
  }
};