import express from 'express';
import protect, { requirePermission, requirePageAccess } from '../middleware/auth.js';
import {
    getServiceEntries,
    getServiceEntry
} from '../controllers/rentalServiceEntryController.js';

const router = express.Router();

// All routes require authentication and page-level access to 'rentals'
router.use(protect);
router.use(requirePageAccess('rentals'));

// Service Entry CRUD
router.route('/')
    .get(requirePermission('rentals.view'), getServiceEntries);

router.route('/:id')
    .get(requirePermission('rentals.view'), getServiceEntry);

export default router;
