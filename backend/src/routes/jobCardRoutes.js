import express from 'express';
import {
    getJobCards,
    getJobCardById,
    createJobCard,
    updateJobCard,
    deleteJobCard,
    getJobCardHistory
} from '../controllers/jobCardController.js';
import {
    getCustomerServiceUpdates,
    createCustomerServiceUpdate,
    deleteCustomerServiceUpdate
} from '../controllers/customerServiceUpdateController.js';
import protect, { requirePermission, requirePageAccess } from '../middleware/auth.js';
import { PERMISSIONS } from '../middleware/permissions.js';

const router = express.Router();

// All routes require authentication and MANAGE_JOB_CARDS permission
router.use(protect);
router.use(requirePageAccess('jobCards'));

router.route('/')
    .get(requirePermission('jobCards.view'), getJobCards)
    .post(requirePermission('jobCards.create'), createJobCard);

router.route('/:id/history')
    .get(requirePermission('jobCards.view'), getJobCardHistory);

router.route('/:id')
    .get(requirePermission('jobCards.view'), getJobCardById)
    .put(requirePermission('jobCards.edit'), updateJobCard)
    .delete(requirePermission('jobCards.delete'), deleteJobCard);

router.route('/:id/customer-updates')
    .get(requirePermission('jobCards.customerUpdates'), getCustomerServiceUpdates)
    .post(requirePermission('jobCards.customerUpdates'), createCustomerServiceUpdate);

router.route('/:id/customer-updates/:updateId')
    .delete(requirePermission('jobCards.customerUpdates'), deleteCustomerServiceUpdate);

export default router;
