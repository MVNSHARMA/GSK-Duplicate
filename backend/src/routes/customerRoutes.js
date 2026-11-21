import express from 'express';
import {
    getCustomers,
    getRegularCustomers,
    createRegularCustomer,
    updateRegularCustomer,
    deleteRegularCustomer,
    getCustomerById,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    getServiceRequests,
    getCustomerTypes,
    getCustomerVehicles,
    linkVehicle,
    unlinkVehicle,
    reassignVehicle,
    getCustomerHistory,
    provisionPortalAccess,
    getPortalUsers
} from '../controllers/customerController.js';
import protect, { requirePermission, requireAnyPermission, requirePageAccess, requireAnyPageAccess } from '../middleware/auth.js';
import { PERMISSIONS } from '../middleware/permissions.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Static routes BEFORE parameterized routes
router.get('/types', requireAnyPageAccess('customers', 'jobCards'), requireAnyPermission('customers.view', 'jobCards.view'), getCustomerTypes);
router.route('/regular')
    .get(requirePageAccess('customers'), requirePermission('customers.view'), getRegularCustomers)
    .post(requirePageAccess('customers'), requirePermission('customers.create'), createRegularCustomer);

router.route('/regular/:id')
    .put(requirePageAccess('customers'), requirePermission('customers.edit'), updateRegularCustomer)
    .delete(requirePageAccess('customers'), requirePermission('customers.delete'), deleteRegularCustomer);

router.route('/')
    .get(requireAnyPageAccess('customers', 'jobCards'), requireAnyPermission('customers.view', 'jobCards.view'), getCustomers)
    .post(requirePageAccess('customers'), requirePermission('customers.create'), createCustomer);

router.route('/:id/service-requests')
    .get(requireAnyPageAccess('customers', 'jobCards'), requireAnyPermission('customers.view', 'jobCards.view'), getServiceRequests);

router.route('/:id/vehicles')
    .get(requireAnyPageAccess('customers', 'jobCards'), requireAnyPermission('customers.view', 'jobCards.view'), getCustomerVehicles);

router.post('/:id/vehicles/link', requirePageAccess('customers'), requirePermission('customers.edit'), linkVehicle);
router.post('/:id/vehicles/unlink', requirePageAccess('customers'), requirePermission('customers.edit'), unlinkVehicle);
router.post('/:id/vehicles/reassign', requirePageAccess('customers'), requirePermission('vehicles.reassign'), reassignVehicle);

router.route('/:id/history')
    .get(requirePageAccess('customers'), requirePermission('customers.view'), getCustomerHistory);

router.post('/:id/provision-portal', requirePageAccess('customers'), requirePermission('customers.provisionPortal'), provisionPortalAccess);
router.get('/:id/portal-users', requirePageAccess('customers'), requirePermission('customers.view'), getPortalUsers);

router.route('/:id')
    .get(requireAnyPageAccess('customers', 'jobCards'), requireAnyPermission('customers.view', 'jobCards.view'), getCustomerById)
    .put(requirePageAccess('customers'), requirePermission('customers.edit'), updateCustomer)
    .delete(requirePageAccess('customers'), requirePermission('customers.delete'), deleteCustomer);

export default router;
