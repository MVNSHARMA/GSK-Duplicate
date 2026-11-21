import express from 'express';
import { 
    getJobCardTimeEntries, 
    clockIn, 
    clockOut 
} from '../controllers/jobCardTimeController.js';
import protect from '../middleware/auth.js';

// Base route: /api/job-cards/:id/time-entries
const router = express.Router({ mergeParams: true });

router.use(protect);

router.get('/', getJobCardTimeEntries);
router.post('/clock-in', clockIn);
router.post('/:timeEntryId/clock-out', clockOut);

export default router;
