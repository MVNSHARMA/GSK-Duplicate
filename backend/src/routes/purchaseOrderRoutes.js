import express from 'express';
import { 
    getPurchaseOrders, 
    getPurchaseOrderById, 
    createPurchaseOrder, 
    updatePurchaseOrder,
    deletePurchaseOrder,
    placePurchaseOrder,
    receivePurchaseOrder,
    cancelPurchaseOrder,
    sendPurchaseOrderEmail,
    getPurchaseOrderEmailHistory,
    downloadPurchaseOrderPDF
} from '../controllers/purchaseOrderController.js';
import protect, { authorizeRoles, requirePermission } from '../middleware/auth.js';

const router = express.Router();

router.route('/')
    .get(protect, requirePermission('purchaseOrders.view'), authorizeRoles('admin', 'super_admin'), getPurchaseOrders)
    .post(protect, requirePermission('purchaseOrders.create'), authorizeRoles('admin', 'super_admin'), createPurchaseOrder);

router.get('/:id/email-history', protect, requirePermission('purchaseOrders.view'), authorizeRoles('admin', 'super_admin'), getPurchaseOrderEmailHistory);
router.get('/:id/pdf', protect, requirePermission('purchaseOrders.view'), authorizeRoles('admin', 'super_admin'), downloadPurchaseOrderPDF);
router.post('/:id/send-email', protect, requirePermission('purchaseOrders.email'), authorizeRoles('admin', 'super_admin'), sendPurchaseOrderEmail);
router.post('/:id/email', protect, requirePermission('purchaseOrders.email'), authorizeRoles('admin', 'super_admin'), sendPurchaseOrderEmail);

router.route('/:id')
    .get(protect, requirePermission('purchaseOrders.view'), authorizeRoles('admin', 'super_admin'), getPurchaseOrderById)
    .put(protect, requirePermission('purchaseOrders.edit'), authorizeRoles('admin', 'super_admin'), updatePurchaseOrder)
    .delete(protect, requirePermission('purchaseOrders.delete'), authorizeRoles('admin', 'super_admin'), deletePurchaseOrder);

router.post('/:id/place', protect, requirePermission('purchaseOrders.place'), authorizeRoles('admin', 'super_admin'), placePurchaseOrder);
router.post('/:id/receive', protect, requirePermission('purchaseOrders.receive'), authorizeRoles('admin', 'super_admin'), receivePurchaseOrder);
router.post('/:id/cancel', protect, requirePermission('purchaseOrders.cancel'), authorizeRoles('admin', 'super_admin'), cancelPurchaseOrder);

export default router;
