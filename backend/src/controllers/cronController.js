import { DateTime } from 'luxon';
import Booking from '../models/Booking.js';
import EmailService from '../services/EmailService.js';
import { runBatchInvoiceArchival } from '../utils/retentionPolicy.js';

export const sendReminders = async (req, res) => {
    // 1. Authentication
    const authHeader = req.headers.authorization;
    const querySecret = req.query.secret;
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
        console.warn('[CRON] CRON_SECRET is not configured in environment variables.');
        return res.status(500).json({ success: false, error: 'CRON_SECRET not configured' });
    }

    const isValidHeader = authHeader === `Bearer ${cronSecret}`;
    const isValidQuery = querySecret === cronSecret;

    if (!isValidHeader && !isValidQuery) {
        console.warn('[CRON] Unauthorized attempt to trigger cron endpoint.');
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // 2. Execute daily idempotent 2-year invoice archival batch (runs regardless of Sydney hour so Vercel Hobby's 0 8 * * * UTC cron always processes archival)
    let retentionArchival = { archivedCount: 0, idempotent: true };
    try {
        retentionArchival = await runBatchInvoiceArchival({ batchSize: 100 });
    } catch (archivalErr) {
        console.error('[CRON] Retention archival batch error:', archivalErr);
    }

    // 3. Determine Australia/Sydney Time & Business Window
    const nowSydney = DateTime.now().setZone('Australia/Sydney');
    const currentHour = nowSydney.hour;
    
    // We only process reminders between 8 AM and 6 PM Sydney time.
    if (currentHour < 8 || currentHour >= 18) {
        console.log(`[CRON] Current Sydney hour is ${currentHour}. Skipping reminders until 8 AM - 6 PM business window.`);
        return res.status(200).json({ 
            success: true, 
            message: 'Outside of 8 AM - 6 PM business window. Skipped reminders; daily retention archival evaluated.',
            retentionArchival
        });
    }

    // The Booking model stores dates as 'EEEE, d MMMM yyyy' strings (e.g. "Monday, 10 September 2026")
    const todayString = nowSydney.toFormat('EEEE, d MMMM yyyy');
    const tomorrowString = nowSydney.plus({ days: 1 }).toFormat('EEEE, d MMMM yyyy');

    let processed = 0, oneDaySent = 0, sameDaySent = 0, skipped = 0, failed = 0;

    try {
        console.log(`[CRON] Starting reminder cron job. Today is ${todayString}. Tomorrow is ${tomorrowString}.`);

        // 3. Process One-Day Reminders (Tomorrow's bookings)
        const oneDayEligible = await Booking.find({
            'appointment.date': tomorrowString,
            status: { $in: ['Pending', 'Confirmed'] },
            oneDayReminderSent: false,
            isActive: true
        }).populate('customerId').populate('vehicleId');

        for (const booking of oneDayEligible) {
            processed++;
            // Note: EmailService internally handles missing emails gracefully
            const success = await EmailService.sendServiceReminder(booking, false);
            if (success) {
                // Safely claim flag using atomic update to ensure idempotency
                const updated = await Booking.findOneAndUpdate(
                    { _id: booking._id, oneDayReminderSent: false },
                    { $set: { oneDayReminderSent: true } },
                    { new: true }
                );
                if (updated) {
                    oneDaySent++;
                } else {
                    skipped++; // Was claimed concurrently
                }
            } else {
                failed++; // Email failed to send, flag remains false for next retry
            }
        }

        // 4. Process Same-Day Reminders (Today's bookings)
        const sameDayEligible = await Booking.find({
            'appointment.date': todayString,
            status: { $in: ['Pending', 'Confirmed'] },
            sameDayReminderSent: false,
            isActive: true
        }).populate('customerId').populate('vehicleId');

        for (const booking of sameDayEligible) {
            processed++;
            const success = await EmailService.sendServiceReminder(booking, true);
            if (success) {
                const updated = await Booking.findOneAndUpdate(
                    { _id: booking._id, sameDayReminderSent: false },
                    { $set: { sameDayReminderSent: true } },
                    { new: true }
                );
                if (updated) {
                    sameDaySent++;
                } else {
                    skipped++;
                }
            } else {
                failed++;
            }
        }

        console.log(`[CRON] Completed. Processed: ${processed}, One-day sent: ${oneDaySent}, Same-day sent: ${sameDaySent}, Skipped: ${skipped}, Failed: ${failed}`);

        return res.status(200).json({
            success: true,
            data: { processed, oneDaySent, sameDaySent, skipped, failed, retentionArchival }
        });

    } catch (error) {
        console.error('[CRON] Error executing cron:', error);
        return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
};
