import express from 'express';
import { getSettings, updateSettings } from '../controllers/settingController.js';
import protect, { requirePermission, requirePageAccess } from '../middleware/auth.js';
import { PERMISSIONS } from '../middleware/permissions.js';
import upload from '../middleware/upload.js';

const router = express.Router();

router.use(protect);
router.use(requirePageAccess('settings'));

router.route('/')
    .get(requirePermission('settings.view'), getSettings)
    .put(requirePermission('settings.edit'), upload.single('logo'), updateSettings);

export default router;
