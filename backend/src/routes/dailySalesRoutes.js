import express from 'express';
import { getDailySales, getTransactionDetails } from '../controllers/dailySalesController.js';
import protect, { requirePageAccess } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);
// Daily Sales requires view permissions for the Daily Sales page
router.use(requirePageAccess('dailySales'));

router.get('/', getDailySales);
router.get('/:sourceType/:sourceId', getTransactionDetails);

export default router;
