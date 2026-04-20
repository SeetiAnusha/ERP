/**
 * Credit Card Register Controller
 * 
 * Handles HTTP requests for credit card transaction management:
 * - Credit card charges and refunds
 * - Credit limit tracking
 * - Transaction history and statements
 * - Integration with Accounts Payable payments
 */

import { Request, Response } from 'express';
import creditCardRegisterService from '../services/creditCardRegisterService';

/**
 * Get all credit card register entries with filtering
 */
export const getAllCreditCardRegister = async (req: Request, res: Response): Promise<void> => {
  try {
    // ✅ Check if pagination is requested
    if (req.query.page || req.query.limit) {
      const options: any = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        search: req.query.search as string,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'ASC' | 'DESC',
        cardId: req.query.cardId ? parseInt(req.query.cardId as string) : undefined,
        transactionType: req.query.transactionType as 'CHARGE' | 'REFUND' | 'ADJUSTMENT' | undefined,
        dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
        dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined
      };
      
      console.log('🔍 CreditCardRegister Controller: Pagination requested');
      const result = await creditCardRegisterService.getAllCreditCardRegister(options);
      res.json(result);
      return;
    }
    
    // ✅ No pagination - return entries directly
    const entries = await creditCardRegisterService.getAllCreditCardRegister({});
    
    console.log('✅ CreditCardRegister Controller: Returning', Array.isArray(entries) ? entries.length : 0, 'entries');
    
    res.status(200).json({
      success: true,
      message: 'Credit card register entries retrieved successfully',
      data: entries // This will be an array
    });
  } catch (error: any) {
    console.error('Error retrieving credit card register entries:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve credit card register entries',
      error: error.message
    });
  }
};

/**
 * Get credit card register entry by ID
 */
export const getCreditCardRegisterById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const entry = await creditCardRegisterService.getCreditCardRegisterById(parseInt(id));
    
    res.status(200).json({
      success: true,
      message: 'Credit card register entry retrieved successfully',
      data: entry
    });
  } catch (error: any) {
    console.error('Error retrieving credit card register entry:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve credit card register entry',
      error: error.message
    });
  }
};

/**
 * Get credit card register entries by card ID
 */
export const getCreditCardRegisterByCardId = async (req: Request, res: Response): Promise<void> => {
  try {
    const { cardId } = req.params;
    const entries = await creditCardRegisterService.getCreditCardRegisterByCardId(parseInt(cardId));
    
    res.status(200).json({
      success: true,
      message: 'Credit card register entries retrieved successfully',
      data: entries
    });
  } catch (error: any) {
    console.error('Error retrieving credit card register entries by card:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve credit card register entries',
      error: error.message
    });
  }
};

/**
 * Create credit card register entry
 */
export const createCreditCardRegister = async (req: Request, res: Response): Promise<void> => {
  try {
    const entry = await creditCardRegisterService.createCreditCardRegister(req.body);
    
    res.status(201).json({
      success: true,
      message: 'Credit card register entry created successfully',
      data: entry
    });
  } catch (error: any) {
    console.error('Error creating credit card register entry:', error);
    res.status(400).json({
      success: false,
      message: 'Failed to create credit card register entry',
      error: error.message
    });
  }
};

/**
 * Process credit card payment for Accounts Payable
 */
export const processCreditCardPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const entry = await creditCardRegisterService.processCreditCardPayment(req.body);
    
    res.status(201).json({
      success: true,
      message: 'Credit card payment processed successfully',
      data: entry
    });
  } catch (error: any) {
    console.error('Error processing credit card payment:', error);
    res.status(400).json({
      success: false,
      message: 'Failed to process credit card payment',
      error: error.message
    });
  }
};

/**
 * Process credit card refund
 */
export const processCreditCardRefund = async (req: Request, res: Response): Promise<void> => {
  try {
    const refund = await creditCardRegisterService.processCreditCardRefund(req.body);
    
    res.status(201).json({
      success: true,
      message: 'Credit card refund processed successfully',
      data: refund
    });
  } catch (error: any) {
    console.error('Error processing credit card refund:', error);
    res.status(400).json({
      success: false,
      message: 'Failed to process credit card refund',
      error: error.message
    });
  }
};

/**
 * Get credit card statement
 */
export const getCreditCardStatement = async (req: Request, res: Response): Promise<void> => {
  try {
    const { cardId } = req.params;
    const { dateFrom, dateTo } = req.query;

    const options = {
      dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
      dateTo: dateTo ? new Date(dateTo as string) : undefined
    };

    const statement = await creditCardRegisterService.getCreditCardStatement(parseInt(cardId), options);
    
    res.status(200).json({
      success: true,
      message: 'Credit card statement retrieved successfully',
      data: statement
    });
  } catch (error: any) {
    console.error('Error retrieving credit card statement:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve credit card statement',
      error: error.message
    });
  }
};

/**
 * Restore credit card by repaying from bank/cash
 */
export const restoreCreditCard = async (req: Request, res: Response): Promise<void> => {
  try {
    const { cardId } = req.params;
    
    console.log('💳 [Controller] Restore credit card request received:');
    console.log('   Card ID:', cardId);
    console.log('   Request body:', JSON.stringify(req.body, null, 2));
    
    const result = await creditCardRegisterService.restoreCreditCard({
      cardId: parseInt(cardId),
      ...req.body
    });
    
    console.log('✅ [Controller] Credit card restored successfully');
    
    res.status(200).json({
      success: true,
      message: 'Credit card restored successfully',
      data: result
    });
  } catch (error: any) {
    console.error('❌ [Controller] Error restoring credit card:', error.message);
    console.error('   Error name:', error.name);
    console.error('   Error statusCode:', error.statusCode);
    console.error('   Error stack:', error.stack);
    
    res.status(error.statusCode || 500).json({
      success: false,
      message: 'Failed to restore credit card',
      error: error.message
    });
  }
};