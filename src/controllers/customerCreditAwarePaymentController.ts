import { Request, Response } from 'express';
import * as customerCreditAwarePaymentService from '../services/customerCreditAwarePaymentService';

/**
 * Get customer payment preview - shows how credit balances will be applied
 */
export const getCustomerPaymentPreview = async (req: Request, res: Response) => {
  try {
    const { customerId, invoiceIds, requestedAmount, useExistingCredit = true } = req.body;
    
    console.log('🔍 Getting customer payment preview for:', { customerId, invoiceIds, requestedAmount, useExistingCredit });
    
    const preview = await customerCreditAwarePaymentService.getCustomerPaymentPreview(
      customerId,
      invoiceIds,
      requestedAmount,
      useExistingCredit
    );
    
    res.json(preview);
  } catch (error: any) {
    console.error('❌ Error getting customer payment preview:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Process customer credit-aware payment
 * Supports both simple and complex scenarios via useExistingCredit flag
 */
export const processCustomerPayment = async (req: Request, res: Response) => {
  try {
    console.log('🎯 Processing customer credit-aware payment...');
    console.log('📋 Request body:', JSON.stringify(req.body, null, 2));
    
    const result = await customerCreditAwarePaymentService.processCustomerCreditAwarePayment(req.body);
    
    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error: any) {
    console.error('❌ Error processing customer credit-aware payment:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Process simple customer payment (no existing credit usage)
 * This is just a wrapper that sets useExistingCredit to false
 */
export const processSimpleCustomerPayment = async (req: Request, res: Response) => {
  try {
    console.log('🎯 Processing SIMPLE customer credit-aware payment...');
    
    // Force disable existing credit usage for simple mode
    const requestWithSimpleMode = {
      ...req.body,
      useExistingCredit: false
    };
    
    const result = await customerCreditAwarePaymentService.processCustomerCreditAwarePayment(requestWithSimpleMode);
    
    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error: any) {
    console.error('❌ Error processing simple customer payment:', error);
    res.status(500).json({ error: error.message });
  }
};