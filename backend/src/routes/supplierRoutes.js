import express from 'express';
import { 
    getSuppliers, 
    getSupplierById, 
    createSupplier, 
    updateSupplier 
} from '../controllers/supplierController.js';
import protect, { authorizeRoles, requirePermission } from '../middleware/auth.js';

const router = express.Router();

router.route('/')
    .get(protect, requirePermission('suppliers.view'), authorizeRoles('admin', 'super_admin'), getSuppliers)
    .post(protect, requirePermission('suppliers.create'), authorizeRoles('admin', 'super_admin'), createSupplier);

router.route('/:id')
    .get(protect, requirePermission('suppliers.view'), authorizeRoles('admin', 'super_admin'), getSupplierById)
    .put(protect, requirePermission('suppliers.edit'), authorizeRoles('admin', 'super_admin'), updateSupplier);

export default router;
