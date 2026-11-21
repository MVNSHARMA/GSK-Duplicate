import express from 'express';
import { sendReminders } from '../controllers/cronController.js';

const router = express.Router();

router.get('/send-reminders', sendReminders);

export default router;
