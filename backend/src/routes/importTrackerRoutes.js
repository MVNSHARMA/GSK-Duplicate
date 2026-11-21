import express from 'express';
import {
    getImports,
    getImportById,
    createImport,
    updateImport,
    deleteImport,
    updateImportStatus
} from '../controllers/importTrackerController.js';
import protect, { requirePermission, requirePageAccess } from '../middleware/auth.js';
import { PERMISSIONS } from '../middleware/permissions.js';

const router = express.Router();

// All routes require authentication and MANAGE_IMPORTS permission
router.use(protect);
router.use(requirePageAccess('importTrackers'));

router.route('/')
    .get(requirePermission('importTrackers.view'), getImports)
    .post(requirePermission('importTrackers.create'), createImport);

router.route('/:id')
    .get(requirePermission('importTrackers.view'), getImportById)
    .put(requirePermission('importTrackers.edit'), updateImport)
    .delete(requirePermission('importTrackers.delete'), deleteImport);

router.route('/:id/status')
    .patch(requirePermission('importTrackers.changeStatus'), updateImportStatus);

export default router;
