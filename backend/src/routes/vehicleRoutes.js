import express from 'express';
import {
    getVehicles,
    getVehicleById,
    createVehicle,
    updateVehicle,
    deleteVehicle,
    getVehicleServiceHistory,
    getVehicleDocuments,
    addVehicleDocument,
    updateVehicleDocument,
    deleteVehicleDocument,
    getVehicleDocumentFile
} from '../controllers/vehicleController.js';
import protect, { requirePermission, requireAnyPermission, requirePageAccess, requireAnyPageAccess } from '../middleware/auth.js';
import { PERMISSIONS } from '../middleware/permissions.js';
import upload from '../middleware/upload.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

router.route('/')
    .get(requireAnyPageAccess('vehicles', 'jobCards'), requireAnyPermission('vehicles.view', 'jobCards.view'), getVehicles)
    .post(requirePageAccess('vehicles'), requirePermission('vehicles.create'), upload.single('image'), createVehicle);

router.route('/:id/history')
    .get(requirePageAccess('vehicles'), requirePermission('vehicles.view'), getVehicleServiceHistory);

router.route('/:id/documents')
    .get(requirePageAccess('vehicles'), requirePermission('vehicles.view'), getVehicleDocuments)
    .post(requirePageAccess('vehicles'), requirePermission('vehicles.edit'), upload.single('document'), addVehicleDocument);

router.route('/documents/:documentId')
    .put(requirePageAccess('vehicles'), requirePermission('vehicles.edit'), updateVehicleDocument)
    .delete(requirePageAccess('vehicles'), requirePermission('vehicles.delete'), deleteVehicleDocument);

router.route('/documents/:documentId/file')
    .get(requirePageAccess('vehicles'), requirePermission('vehicles.view'), getVehicleDocumentFile);

router.route('/:id')
    .get(requireAnyPageAccess('vehicles', 'jobCards'), requireAnyPermission('vehicles.view', 'jobCards.view'), getVehicleById)
    .put(requirePageAccess('vehicles'), requirePermission('vehicles.edit'), upload.single('image'), updateVehicle)
    .delete(requirePageAccess('vehicles'), requirePermission('vehicles.delete'), deleteVehicle);

export default router;
