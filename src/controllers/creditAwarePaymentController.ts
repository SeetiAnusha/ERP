import { Request, Response } from 'express';
import * as creditAwarePaymentService from '../services/creditAwarePaymentService';
import { creditBalanceService } from '../services/creditBalanceService';

/**
 * Check credit balance for a supplier (for Bank Register modal)
 */
export const checkCreditBalance = async (req: Request, res: Response) => {
  try {
    const { supplierId } = req.params;
    const { paymentAmount } = req.query;
    
    console.log('🔍 Checking credit balance for supplier:', { supplierId, paymentAmount });
    
    // Get available credit balances for supplier
    const availableCredits = await creditBalanceService.getCreditBalancesByEntity(
      'SUPPLIER',
      parseInt(supplierId)
    );
    
    const totalAvailableCredit = availableCredits.reduce((sum: number, credit: any) => 
      sum + parseFloat(credit.availableAmount.toString()), 0
    );
    
    const requestedAmount = paymentAmount ? parseFloat(paymentAmount as string) : 0;
    const canCoverPayment = totalAvailableCredit >= requestedAmount;
    
    let suggestion = '';
    if (totalAvailableCredit > 0 && requestedAmount > 0) {
      if (canCoverPayment) {
        suggestion = `✅ Credit balance (₹${totalAvailableCredit.toFixed(2)}) can fully cover this payment. Use credit payment instead of bank payment.`;
      } else {
        suggestion = `⚠️ Credit balance (₹${totalAvailableCredit.toFixed(2)}) can partially cover this payment. Consider using credit + bank payment combination.`;
      }
    } else if (totalAvailableCredit > 0) {
      suggestion = `💡 Credit balance available (₹${totalAvailableCredit.toFixed(2)}) for this supplier. Consider using credit payment for future transactions.`;
    } else {
      suggestion = `ℹ️ No credit balance available for this supplier. Bank payment is required.`;
    }
    
    const result = {
      supplierId: parseInt(supplierId),
      creditBalance: totalAvailableCredit,
      requestedAmount,
      canCoverPayment,
      suggestion,
      hasCredit: totalAvailableCredit > 0
    };
    
    console.log('💡 Credit balance check result:', result);
    res.json(result);
  } catch (error: any) {
    console.error('❌ Error checking credit balance:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get payment preview - shows how credit balances will be applied
 */
export const getPaymentPreview = async (req: Request, res: Response) => {
  try {
    const { supplierId, invoiceIds, requestedAmount, bankAccountId } = req.body;
    
    console.log('🔍 Getting payment preview for:', { supplierId, invoiceIds, requestedAmount, bankAccountId });
    
    const preview = await creditAwarePaymentService.getPaymentPreview(
      supplierId,
      invoiceIds,
      requestedAmount,
      bankAccountId
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