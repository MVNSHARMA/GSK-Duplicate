import express from 'express';
import {
    getCustomerTemplates,
    createTemplate,
    updateTemplate,
    deactivateTemplate
} from '../controllers/vehicleTemplateController.js';
import protect, { requirePermission, requirePageAccess } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication and page access to customers
router.use(protect);
router.use(requirePageAccess('customers'));

router.route('/customer/:customerId')
    .get(
        requirePermission('customers.view'),
        getCustomerTemplates
    );

router.route('/')
    .post(
        requirePermission('customers.create'),
        createTemplate
    );

router.route('/:id')
    .put(
        requirePermission('customers.edit'),
        updateTemplate
    )
    .delete(
        requirePermission('customers.delete'),
        deactivateTemplate
    );

export default router;
