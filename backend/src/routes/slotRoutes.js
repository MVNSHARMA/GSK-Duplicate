import express from 'express';
import { getSlotsByDate, updateSlotConfig } from '../controllers/slotController.js';
import protect, { authorizeRoles, requirePermission } from '../middleware/auth.js';

const router = express.Router();

// Public route to get slots for booking page
router.get('/', getSlotsByDate);

// Protected route for Admin to configure slots
router.put('/', protect, requirePermission('bookingSlots.edit'), authorizeRoles('admin', 'super_admin'), updateSlotConfig);

export default router;
