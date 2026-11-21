import express from 'express';
import {
    getTrashItems,
    restoreItem,
    deleteItemPermanently,
    bulkDeleteItems
} from '../controllers/trashController.js';
import protect, { authorizeRoles, requirePermission, requirePageAccess } from '../middleware/auth.js';

const router = express.Router();

// Require authentication for all trash routes
router.use(protect);
router.use(requirePageAccess('trash'));

router.route('/')
    .get(requirePermission('trash.view'), authorizeRoles('admin', 'super_admin'), getTrashItems);

router.route('/:type/:id/restore')
    .put(requirePermission('trash.restore'), authorizeRoles('admin', 'super_admin'), restoreItem);

router.route('/bulk-delete')
    .post(requirePermission('trash.delete'), authorizeRoles('super_admin'), bulkDeleteItems);

router.route('/:type/:id')
    .delete(requirePermission('trash.delete'), authorizeRoles('super_admin'), deleteItemPermanently);

export default router;
