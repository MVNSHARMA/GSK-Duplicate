import express from 'express';
import {
    getBatches,
    getBatchById,
    createBatch,
    updateBatch,
    getBatchVehicles,
    addVehicleToBatch,
    removeVehicleFromBatch,
    bulkImportVehicles,
    updateVehicleStatus,
    bulkUpdateVehicleStatus,
    updateTrackerCar,
    deleteBatch,
    bulkAddTrackerCars,
    receiveTrackerCar,
    inspectTrackerCar,
    markCollectedTrackerCar,
    getTrackerCarById,
    bulkCollectTrackerCars,
    markDeliveredTrackerCar,
    bulkDeliverTrackerCars,
    uploadTrackerCarDocument,
    deleteTrackerCarDocument,
    getTrackerCarDocuments,
    reopenTrackerCarStatus,
    bulkAddRegisteredVehiclesToBatch
} from '../controllers/vehicleBatchController.js';
import protect, { authorizeRoles, requirePermission } from '../middleware/auth.js';
import upload from '../middleware/upload.js';

const router = express.Router();

router.use(protect);

// Routes accessible by users (company clients) and admins
router.get('/', getBatches);
router.get('/cars/:carId', getTrackerCarById);
router.get('/:id', getBatchById);
router.get('/:id/vehicles', getBatchVehicles);

// Routes restricted to admins/super_admins
router.post('/', requirePermission('vehicleBatches.create'), authorizeRoles('admin', 'super_admin'), createBatch);
router.put('/:id', requirePermission('vehicleBatches.edit'), authorizeRoles('admin', 'super_admin'), updateBatch);
router.post('/:id/vehicles', requirePermission('vehicleBatches.edit'), authorizeRoles('admin', 'super_admin'), addVehicleToBatch);
router.delete('/:id/vehicles/:membershipId', requirePermission('vehicleBatches.delete'), authorizeRoles('admin', 'super_admin'), removeVehicleFromBatch);
router.post('/:id/bulk-import', requirePermission('vehicleBatches.bulkImport'), authorizeRoles('admin', 'super_admin'), bulkImportVehicles);
router.patch('/:id/cars/status', requirePermission('vehicleBatches.edit'), authorizeRoles('admin', 'super_admin'), bulkUpdateVehicleStatus);
router.patch('/:id/cars/:carId/status', requirePermission('vehicleBatches.edit'), authorizeRoles('admin', 'super_admin'), updateVehicleStatus);
router.delete('/:id', requirePermission('vehicleBatches.delete'), authorizeRoles('admin', 'super_admin'), deleteBatch);
router.post('/:id/cars/bulk', requirePermission('vehicleBatches.edit'), authorizeRoles('admin', 'super_admin'), bulkAddTrackerCars);
router.post('/:id/registered-vehicles', requirePermission('vehicleBatches.edit'), authorizeRoles('admin', 'super_admin'), bulkAddRegisteredVehiclesToBatch);

// Update single tracker car fields (rego, notes, status)
router.patch('/:id/cars/:carId', requirePermission('vehicleBatches.edit'), authorizeRoles('admin', 'super_admin'), updateTrackerCar);

// New Operational Endpoints
router.post('/:id/cars/:carId/receive', requirePermission('vehicleBatches.edit'), authorizeRoles('admin', 'super_admin'), receiveTrackerCar);
router.post('/:id/cars/:carId/inspect', requirePermission('vehicleBatches.edit'), authorizeRoles('admin', 'super_admin'), inspectTrackerCar);
router.post('/:id/cars/:carId/collect', requirePermission('vehicleBatches.edit'), authorizeRoles('admin', 'super_admin'), markCollectedTrackerCar);
router.post('/:id/cars/bulk-collect', requirePermission('vehicleBatches.edit'), authorizeRoles('admin', 'super_admin'), bulkCollectTrackerCars);
router.post('/:id/cars/:carId/deliver', requirePermission('vehicleBatches.edit'), authorizeRoles('admin', 'super_admin'), markDeliveredTrackerCar);
router.post('/:id/cars/bulk-deliver', requirePermission('vehicleBatches.edit'), authorizeRoles('admin', 'super_admin'), bulkDeliverTrackerCars);
router.patch('/:id/cars/:carId/reopen-status', requirePermission('vehicleBatches.edit'), authorizeRoles('admin', 'super_admin'), reopenTrackerCarStatus);

// Documents & Photos
router.get('/:batchId/cars/:carId/documents', authorizeRoles('admin', 'super_admin'), getTrackerCarDocuments);
router.post('/:batchId/cars/:carId/documents', requirePermission('vehicleBatches.edit'), authorizeRoles('admin', 'super_admin'), upload.single('file'), uploadTrackerCarDocument);
router.delete('/:batchId/cars/:carId/documents/:documentId', requirePermission('vehicleBatches.edit'), authorizeRoles('admin', 'super_admin'), deleteTrackerCarDocument);

export default router;
