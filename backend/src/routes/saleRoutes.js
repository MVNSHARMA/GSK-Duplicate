import express from 'express';
import {
    getSales,
    createSale,
    updateSale,
    deleteSale
} from '../controllers/saleController.js';
import protect, { requirePermission, requirePageAccess } from '../middleware/auth.js';
import { PERMISSIONS } from '../middleware/permissions.js';

const router = express.Router();

// All routes require authentication and MANAGE_SALES permission
router.use(protect);
router.use(requirePageAccess('dailySales'));

router.route('/')
    .get(requirePermission('dailySales.view'), getSales)
    .post(requirePermission('dailySales.create'), createSale);

router.route('/:id')
    .put(requirePermission('dailySales.edit'), updateSale)
    .delete(requirePermission('dailySales.delete'), deleteSale);

export default router;
