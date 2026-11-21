import { DateTime } from 'luxon';

export const SYDNEY_ZONE = 'Australia/Sydney';

/**
 * Parses a date string and optional time string in the Australia/Sydney timezone.
 */
export const parseSydneyDateTime = (dateStr, timeStr) => {
    if (!dateStr || typeof dateStr !== 'string') return null;

    const cleanDate = dateStr.replace(/^[A-Za-z]+,\s*/, '').trim();
    let parsedDate = DateTime.fromFormat(dateStr.trim(), 'EEEE, d MMMM yyyy', { zone: SYDNEY_ZONE });
    if (!parsedDate.isValid) {
        parsedDate = DateTime.fromFormat(cleanDate, 'd MMMM yyyy', { zone: SYDNEY_ZONE });
    }
    if (!parsedDate.isValid) {
        parsedDate = DateTime.fromFormat(dateStr.trim(), 'yyyy-MM-dd', { zone: SYDNEY_ZONE });
    }
    if (!parsedDate.isValid) {
        parsedDate = DateTime.fromISO(dateStr.trim(), { zone: SYDNEY_ZONE });
    }
    if (!parsedDate.isValid) return null;

    if (!timeStr) {
        return parsedDate.startOf('day');
    }

    let parsedTime = DateTime.fromFormat(timeStr.trim(), 'h:mm a', { zone: SYDNEY_ZONE });
    if (!parsedTime.isValid) {
        parsedTime = DateTime.fromFormat(timeStr.trim(), 'hh:mm a', { zone: SYDNEY_ZONE });
    }
    if (!parsedTime.isValid) {
        parsedTime = DateTime.fromFormat(timeStr.trim(), 'H:mm', { zone: SYDNEY_ZONE });
    }
    if (!parsedTime.isValid) {
        parsedTime = DateTime.fromFormat(timeStr.trim(), 'HH:mm', { zone: SYDNEY_ZONE });
    }
    if (!parsedTime.isValid) return null;

    return parsedDate.set({
        hour: parsedTime.hour,
        minute: parsedTime.minute,
        second: 0,
        millisecond: 0
    });
};

/**
 * Checks if a slot date and time is in the past in Australia/Sydney.
 */
export const isSlotPastInSydney = (dateStr, timeStr, referenceDateTime = DateTime.now().setZone(SYDNEY_ZONE)) => {
    const target = parseSydneyDateTime(dateStr, timeStr);
    if (!target || !target.isValid) return true;
    return target.startOf('minute') < referenceDateTime.startOf('minute');
};
