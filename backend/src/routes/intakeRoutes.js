import express from 'express';
import rateLimit from 'express-rate-limit';
import { createBooking, createQuote, submitContact } from '../controllers/intakeController.js';
import upload from '../middleware/upload.js';

const router = express.Router();

const intakeLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 15,
    skip: (req) => process.env.NODE_ENV === 'test' && req.headers['x-test-rate-limit'] !== 'true',
    message: { success: false, error: 'Submission limit reached. Please try again shortly.' }
});

router.post('/book', intakeLimiter, upload.array('images', 5), createBooking);
router.post('/quote', intakeLimiter, upload.array('images', 5), createQuote);
router.post('/contact', intakeLimiter, submitContact);

export default router;
