import express from 'express';
import {
    getInventory,
    getInventoryItem,
    createInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    addVariant,
    updateVariant,
    deleteVariant,
    adjustStock,
    getTransactions,
    getVariantChildren,
    searchPurchaseOrderItems
} from '../controllers/inventoryController.js';
import protect, { requirePermission, requireAnyPermission, requirePageAccess, requireAnyPageAccess } from '../middleware/auth.js';
import { PERMISSIONS } from '../middleware/permissions.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

router.get('/purchase-order-items', requirePageAccess('inventory'), requirePermission('inventory.view'), searchPurchaseOrderItems);

router.route('/')
    .get(requireAnyPageAccess('inventory', 'jobCards'), requireAnyPermission('inventory.view', 'jobCards.view'), getInventory)
    .post(requirePageAccess('inventory'), requirePermission('inventory.create'), createInventoryItem);

router.get('/transactions', requirePageAccess('inventory'), requirePermission('inventory.view'), getTransactions);

router.get('/:id/children', requireAnyPageAccess('inventory', 'jobCards'), requireAnyPermission('inventory.view', 'jobCards.view'), getVariantChildren);

router.route('/:id')
    .get(requireAnyPageAccess('inventory', 'jobCards'), requireAnyPermission('inventory.view', 'jobCards.view'), getInventoryItem)
    .put(requirePageAccess('inventory'), requirePermission('inventory.edit'), updateInventoryItem)
    .delete(requirePageAccess('inventory'), requirePermission('inventory.delete'), deleteInventoryItem);

router.post('/:id/variants', requirePageAccess('inventory'), requirePermission('inventory.edit'), addVariant);
router.put('/:id/variants/:variantId', requirePageAccess('inventory'), requirePermission('inventory.edit'), updateVariant);
router.delete('/:id/variants/:variantId', requirePageAccess('inventory'), requirePermission('inventory.delete'), deleteVariant);
router.post('/:id/variants/:variantId/adjust-stock', requirePageAccess('inventory'), requirePermission('inventory.adjustStock'), adjustStock);

export default router;
