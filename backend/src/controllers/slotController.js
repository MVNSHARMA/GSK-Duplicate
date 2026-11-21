import BookingSlot from '../models/BookingSlot.js';
import Booking from '../models/Booking.js';
import { DateTime } from 'luxon';
import { parseSydneyDateTime, SYDNEY_ZONE } from '../utils/sydneyTime.js';

const DEFAULT_SLOTS = ['9:00 AM', '9:30 AM', '11:00 AM', '1:30 PM', '3:00 PM', '4:30 PM'];

// Helper to parse "9:30 AM" into minutes from midnight
const parseTime = (timeStr) => {
    const [time, modifier] = timeStr.split(' ');
    let [hours, minutes] = time.split(':');
    hours = parseInt(hours);
    if (hours === 12) hours = 0;
    if (modifier === 'PM' || modifier === 'P.M.') hours += 12;
    return hours * 60 + parseInt(minutes);
};

// @desc    Get slots for a specific date
// @route   GET /api/slots
// @access  Public
export const getSlotsByDate = async (req, res) => {
    try {
        const { date, includePast } = req.query;
        if (!date) return res.status(400).json({ success: false, message: 'Date is required' });

        // Fetch Global Settings for default capacity
        const mongoose = await import('mongoose');
        const Setting = mongoose.model('Setting');
        const settings = await Setting.findOne() || {};
        const defaultCapacity = settings.defaultBookingCapacity || 3;

        // 1. Fetch DB configured slots
        const configuredSlots = await BookingSlot.find({ date });
        const configMap = {};
        configuredSlots.forEach(s => configMap[s.time] = s);

        // 2. Fetch active bookings
        const bookings = await Booking.find({ 
            'appointment.date': date, 
            status: { $ne: 'Cancelled' } 
        });

        const bookingCountMap = {};
        bookings.forEach(b => {
            bookingCountMap[b.appointment.time] = (bookingCountMap[b.appointment.time] || 0) + 1;
        });

        // 3. Merge default times with configured times
        const allTimes = new Set([...DEFAULT_SLOTS, ...configuredSlots.map(s => s.time)]);
        const sortedTimes = Array.from(allTimes).sort((a, b) => parseTime(a) - parseTime(b));

        // 4. Past Date/Time Check (Timezone Aware - Australia/Sydney)
        const nowSydney = DateTime.now().setZone(SYDNEY_ZONE);
        const nowSydneyMinute = nowSydney.startOf('minute');
        const dayDateTime = parseSydneyDateTime(date);
        const isDateInPast = dayDateTime && dayDateTime.endOf('day') < nowSydney;

        // If entire date has passed and includePast is not requested, return empty slots immediately
        if (isDateInPast && includePast !== 'true') {
            return res.json({ success: true, data: [] });
        }
        
        // 5. Construct Response
        const result = [];
        for (const time of sortedTimes) {
            const config = configMap[time] || { capacity: defaultCapacity, isDisabled: false };
            const booked = bookingCountMap[time] || 0;
            const remaining = Math.max(0, config.capacity - booked);
            
            let isPast = false;
            const targetDateTime = parseSydneyDateTime(date, time);

            if (targetDateTime) {
                if (targetDateTime.startOf('minute') < nowSydneyMinute) {
                    isPast = true;
                }
            } else if (isDateInPast) {
                isPast = true;
            }

            // Hide past slots completely for customer booking view
            if (isPast && includePast !== 'true') {
                continue;
            }

            let status = 'Available';
            if (config.isDisabled) status = 'Disabled';
            else if (isPast) status = 'Past';
            else if (remaining === 0) status = 'Full';

            result.push({
                time,
                capacity: config.capacity,
                booked,
                remaining,
                isDisabled: config.isDisabled,
                isPast,
                status
            });
        }

        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error fetching slots:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// @desc    Update or create a slot configuration
// @route   PUT /api/slots
// @access  Private (Admin)
export const updateSlotConfig = async (req, res) => {
    try {
        const { date, time, capacity, isDisabled } = req.body;
        
        if (!date || !time) {
            return res.status(400).json({ success: false, message: 'Date and time are required' });
        }

        const updateData = {};
        if (capacity !== undefined) updateData.capacity = capacity;
        if (isDisabled !== undefined) updateData.isDisabled = isDisabled;

        const slot = await BookingSlot.findOneAndUpdate(
            { date, time },
            { $set: updateData },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        res.json({ success: true, data: slot, message: 'Slot updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
