/**
 * Utility functions for timezone-aware (Australia/Sydney) date and time operations.
 * Enforces Sydney calendar calculations regardless of user device / browser timezone.
 */

export const SYDNEY_TIMEZONE = 'Australia/Sydney';

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export const DAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
];

/**
 * Returns the current date/time decomposed into Australia/Sydney components.
 */
export const getSydneyNow = (referenceDate = new Date()) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: SYDNEY_TIMEZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
    weekday: 'long'
  });

  const parts = formatter.formatToParts(referenceDate);
  const map = {};
  for (const part of parts) {
    map[part.type] = part.value;
  }

  const hour = parseInt(map.hour, 10);
  return {
    year: parseInt(map.year, 10),
    monthIndex: parseInt(map.month, 10) - 1, // 0-indexed month (0 = January)
    day: parseInt(map.day, 10),
    hour: hour === 24 ? 0 : hour,
    minute: parseInt(map.minute, 10),
    second: parseInt(map.second, 10),
    weekday: map.weekday
  };
};

/**
 * Formats a Sydney date as "Tuesday, 27 October 2026".
 */
export const formatSydneyDateString = (year, monthIndex, day) => {
  const d = new Date(Date.UTC(year, monthIndex, day));
  const weekday = DAY_NAMES[d.getUTCDay()];
  return `${weekday}, ${day} ${MONTH_NAMES[monthIndex]} ${year}`;
};

/**
 * Returns today's formatted date string in Australia/Sydney.
 */
export const getTodaySydneyDateString = (referenceDate = new Date()) => {
  const now = getSydneyNow(referenceDate);
  return formatSydneyDateString(now.year, now.monthIndex, now.day);
};

/**
 * Parses a date string (e.g. "Tuesday, 27 October 2026" or "2026-10-27") into { year, monthIndex, day }.
 */
export const parseBookingDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return null;

  // Format: "Tuesday, 27 October 2026" or "27 October 2026"
  const clean = dateStr.replace(/^[A-Za-z]+,\s*/, '').trim();
  const textMatch = clean.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (textMatch) {
    const day = parseInt(textMatch[1], 10);
    const monthName = textMatch[2];
    const year = parseInt(textMatch[3], 10);
    const monthIndex = MONTH_NAMES.findIndex(
      m => m.toLowerCase() === monthName.toLowerCase()
    );
    if (monthIndex !== -1 && !isNaN(day) && !isNaN(year)) {
      return { year, monthIndex, day };
    }
  }

  // Format: "YYYY-MM-DD"
  const isoMatch = dateStr.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    return {
      year: parseInt(isoMatch[1], 10),
      monthIndex: parseInt(isoMatch[2], 10) - 1,
      day: parseInt(isoMatch[3], 10)
    };
  }

  return null;
};

/**
 * Parses a time string (e.g. "3:00 PM", "9:30 AM") into { hour24, minute }.
 */
export const parseSlotTime = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return null;

  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;

  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const modifier = match[3] ? match[3].toUpperCase() : null;

  if (modifier === 'PM' && hour < 12) hour += 12;
  if (modifier === 'AM' && hour === 12) hour = 0;

  return { hour24: hour, minute };
};

/**
 * Checks whether a given booking date and slot time has already passed in Australia/Sydney.
 *
 * Rules:
 * - If slot date is before today in Sydney: expired (true).
 * - If slot date is after today in Sydney: not expired (false).
 * - If slot date is today in Sydney:
 *     - If slot start time is strictly before current Sydney time (at the minute level): expired (true).
 *     - Example: If Sydney time is 3:00 PM, 3:00 PM is NOT expired (false).
 *     - If Sydney time is 3:15 PM, 3:00 PM IS expired (true).
 */
export const isSlotPastInSydney = (dateStr, timeStr, referenceDate = new Date()) => {
  const sydneyNow = getSydneyNow(referenceDate);
  const slotDate = parseBookingDate(dateStr);
  if (!slotDate) return false;

  // Compare calendar date
  if (slotDate.year < sydneyNow.year) return true;
  if (slotDate.year > sydneyNow.year) return false;

  if (slotDate.monthIndex < sydneyNow.monthIndex) return true;
  if (slotDate.monthIndex > sydneyNow.monthIndex) return false;

  if (slotDate.day < sydneyNow.day) return true;
  if (slotDate.day > sydneyNow.day) return false;

  // Date is TODAY in Sydney. Check time:
  if (!timeStr) return false;
  const slotTime = parseSlotTime(timeStr);
  if (!slotTime) return false;

  const slotMinutes = slotTime.hour24 * 60 + slotTime.minute;
  const nowMinutes = sydneyNow.hour * 60 + sydneyNow.minute;

  return slotMinutes < nowMinutes;
};

/**
 * Checks whether a calendar day (year, monthIndex, day) is in the past relative to Sydney today.
 */
export const isDayInPastInSydney = (year, monthIndex, day, referenceDate = new Date()) => {
  const sydneyNow = getSydneyNow(referenceDate);

  if (year < sydneyNow.year) return true;
  if (year > sydneyNow.year) return false;

  if (monthIndex < sydneyNow.monthIndex) return true;
  if (monthIndex > sydneyNow.monthIndex) return false;

  return day < sydneyNow.day;
};
