import express from 'express';
import {
    getDealerCars,
    createDealerCar,
    updateDealerCar,
    deleteDealerCar,
    uploadBuyerLicenseDocument
} from '../controllers/dealerCarController.js';
import protect, { requirePermission, requirePageAccess } from '../middleware/auth.js';
import { PERMISSIONS } from '../middleware/permissions.js';
import upload from '../middleware/upload.js';

const router = express.Router();

// All routes require authentication and MANAGE_DEALER_CARS permission
router.use(protect);
router.use(requirePageAccess('dealerCars'));

router.post('/upload-license', requirePermission('dealerCars.edit'), upload.single('licenseDocument'), uploadBuyerLicenseDocument);

router.route('/')
    .get(requirePermission('dealerCars.view'), getDealerCars)
    .post(requirePermission('dealerCars.create'), upload.single('licenseDocument'), createDealerCar);

router.route('/:id')
    .put(requirePermission('dealerCars.edit'), upload.single('licenseDocument'), updateDealerCar)
    .delete(requirePermission('dealerCars.delete'), deleteDealerCar);

export default router;
