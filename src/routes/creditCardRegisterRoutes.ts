/**
 * Credit Card Register Routes
 * 
 * RESTful API routes for credit card transaction management:
 * - GET /credit-card-register - List all entries with filtering
 * - GET /credit-card-register/:id - Get specific entry
 * - GET /credit-card-register/card/:cardId - Get entries by card
 * - POST /credit-card-register - Create new entry
 * - POST /credit-card-register/payment - Process AP payment
 * - POST /credit-card-register/refund - Process refund
 * - GET /credit-card-register/statement/:cardId - Get card statement
 */

import { Router } from 'express';
import {
  getAllCreditCardRegister,
  getCreditCardRegisterById,
  getCreditCardRegisterByCardId,
  createCreditCardRegister,
  processCreditCardPayment,
  processCreditCardRefund,
  getCreditCardStatement
} from '../controllers/creditCardRegisterController';

const router = Router();

// GET routes
router.get('/', getAllCreditCardRegister);
router.get('/:id', getCreditCardRegisterById);
router.get('/card/:cardId', getCreditCardRegisterByCardId);
router.get('/statement/:cardId', getCreditCardStatement);

// POST routes
router.post('/', createCreditCardRegister);
router.post('/payment', processCreditCardPayment);
router.post('/refund', processCreditCardRefund);

export default router;