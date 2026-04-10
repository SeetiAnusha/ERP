import express from 'express';
import * as trialBalanceController from '../../controllers/accounting/trialBalanceController';

const router = express.Router();

router.get('/', trialBalanceController.getTrialBalance);

export default router;
