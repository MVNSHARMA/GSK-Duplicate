import test from 'node:test';
import assert from 'node:assert/strict';
import { DateTime } from 'luxon';
import { parseSydneyDateTime, isSlotPastInSydney as backendIsSlotPast, SYDNEY_ZONE } from './src/utils/sydneyTime.js';
import { 
  getSydneyNow, 
  getTodaySydneyDateString, 
  formatSydneyDateString, 
  isSlotPastInSydney as frontendIsSlotPast, 
  isDayInPastInSydney,
  parseBookingDate,
  parseSlotTime 
} from '../frontend/src/utils/sydneyTime.js';

test('1. Today at 3:00 PM Sydney time: Slots before 3:00 PM are hidden; slots at or after 3:00 PM remain visible', () => {
  // Simulate reference time: 27 October 2026 at 15:00:00 (3:00 PM) in Sydney
  const refSydney = DateTime.fromISO('2026-10-27T15:00:00', { zone: SYDNEY_ZONE });
  const refJsDate = new Date(refSydney.toMillis());
  const dateStr = 'Tuesday, 27 October 2026';

  const testSlots = [
    { time: '9:00 AM' },
    { time: '12:00 PM' },
    { time: '2:30 PM' },
    { time: '2:59 PM' },
    { time: '3:00 PM' },
    { time: '3:30 PM' },
    { time: '5:00 PM' }
  ];

  // Backend filter
  const backendVisible = testSlots.filter(s => !backendIsSlotPast(dateStr, s.time, refSydney));
  assert.deepEqual(
    backendVisible.map(s => s.time),
    ['3:00 PM', '3:30 PM', '5:00 PM'],
    'Backend should hide slots before 3:00 PM and keep 3:00 PM onward'
  );

  // Frontend filter
  const frontendVisible = testSlots.filter(s => !frontendIsSlotPast(dateStr, s.time, refJsDate));
  assert.deepEqual(
    frontendVisible.map(s => s.time),
    ['3:00 PM', '3:30 PM', '5:00 PM'],
    'Frontend should hide slots before 3:00 PM and keep 3:00 PM onward'
  );
});

test('2. Today at 3:15 PM Sydney time: The 3:00 PM slot is hidden', () => {
  // Simulate reference time: 27 October 2026 at 15:15:00 (3:15 PM) in Sydney
  const refSydney = DateTime.fromISO('2026-10-27T15:15:00', { zone: SYDNEY_ZONE });
  const refJsDate = new Date(refSydney.toMillis());
  const dateStr = 'Tuesday, 27 October 2026';

  assert.equal(backendIsSlotPast(dateStr, '3:00 PM', refSydney), true, 'Backend: 3:00 PM slot must be expired at 3:15 PM');
  assert.equal(frontendIsSlotPast(dateStr, '3:00 PM', refJsDate), true, 'Frontend: 3:00 PM slot must be expired at 3:15 PM');

  // 3:30 PM should still be visible
  assert.equal(backendIsSlotPast(dateStr, '3:30 PM', refSydney), false, 'Backend: 3:30 PM slot must not be expired at 3:15 PM');
  assert.equal(frontendIsSlotPast(dateStr, '3:30 PM', refJsDate), false, 'Frontend: 3:30 PM slot must not be expired at 3:15 PM');
});

test('3. Future date: All otherwise valid slots are displayed', () => {
  const refSydney = DateTime.fromISO('2026-10-27T15:00:00', { zone: SYDNEY_ZONE });
  const refJsDate = new Date(refSydney.toMillis());
  const futureDateStr = 'Wednesday, 28 October 2026';

  const testSlots = ['9:00 AM', '10:00 AM', '12:00 PM', '3:00 PM', '5:00 PM'];

  for (const slot of testSlots) {
    assert.equal(backendIsSlotPast(futureDateStr, slot, refSydney), false, `Future slot ${slot} must be visible on backend`);
    assert.equal(frontendIsSlotPast(futureDateStr, slot, refJsDate), false, `Future slot ${slot} must be visible on frontend`);
  }
});

test('4. Past date: No bookable slots are displayed', () => {
  const refSydney = DateTime.fromISO('2026-10-27T15:00:00', { zone: SYDNEY_ZONE });
  const refJsDate = new Date(refSydney.toMillis());
  const pastDateStr = 'Monday, 26 October 2026';

  const testSlots = ['9:00 AM', '12:00 PM', '3:00 PM', '5:00 PM'];

  for (const slot of testSlots) {
    assert.equal(backendIsSlotPast(pastDateStr, slot, refSydney), true, `Past date slot ${slot} must be expired on backend`);
    assert.equal(frontendIsSlotPast(pastDateStr, slot, refJsDate), true, `Past date slot ${slot} must be expired on frontend`);
  }

  // Calendar day check
  const isPastDay = isDayInPastInSydney(2026, 9, 26, refJsDate); // monthIndex 9 = October
  assert.equal(isPastDay, true, '26 October 2026 must be recognized as past day when today is 27 October 2026');
});

test('5. Slot expires while the page is open: Disappears dynamically when clock advances', () => {
  const dateStr = 'Tuesday, 27 October 2026';

  // State 1: 2:59 PM - 3:00 PM slot is still in future
  const time1 = DateTime.fromISO('2026-10-27T14:59:00', { zone: SYDNEY_ZONE });
  assert.equal(frontendIsSlotPast(dateStr, '3:00 PM', new Date(time1.toMillis())), false, 'At 2:59 PM, 3:00 PM is not expired');

  // State 2: 3:00 PM - 3:00 PM slot is currently eligible
  const time2 = DateTime.fromISO('2026-10-27T15:00:00', { zone: SYDNEY_ZONE });
  assert.equal(frontendIsSlotPast(dateStr, '3:00 PM', new Date(time2.toMillis())), false, 'At 3:00 PM, 3:00 PM is not expired');

  // State 3: 3:01 PM - 3:00 PM slot is now expired
  const time3 = DateTime.fromISO('2026-10-27T15:01:00', { zone: SYDNEY_ZONE });
  assert.equal(frontendIsSlotPast(dateStr, '3:00 PM', new Date(time3.toMillis())), true, 'At 3:01 PM, 3:00 PM has expired');
});

test('6. Backend date/time parsing handles weekday variations and formats reliably', () => {
  const dt1 = parseSydneyDateTime('Tuesday, 27 October 2026', '3:00 PM');
  assert.ok(dt1 && dt1.isValid);
  assert.equal(dt1.year, 2026);
  assert.equal(dt1.month, 10);
  assert.equal(dt1.day, 27);
  assert.equal(dt1.hour, 15);
  assert.equal(dt1.minute, 0);

  // Even if weekday in date string does not match (e.g. client sent wrong day-of-week)
  const dt2 = parseSydneyDateTime('Monday, 27 October 2026', '15:00');
  assert.ok(dt2 && dt2.isValid);
  assert.equal(dt2.day, 27);
  assert.equal(dt2.hour, 15);

  // ISO date
  const dt3 = parseSydneyDateTime('2026-10-27', '9:30 AM');
  assert.ok(dt3 && dt3.isValid);
  assert.equal(dt3.hour, 9);
  assert.equal(dt3.minute, 30);
});

test('7. Timezone resilience: Functions evaluate against Sydney time regardless of device timezone', () => {
  // Let reference timestamp be 2026-10-27T04:30:00Z (UTC).
  // In Sydney (UTC+11 due to Daylight Saving Time in October), this is 2026-10-27 15:30:00 (3:30 PM).
  const utcDate = new Date('2026-10-27T04:30:00Z');
  const sydneyComponents = getSydneyNow(utcDate);

  assert.equal(sydneyComponents.year, 2026);
  assert.equal(sydneyComponents.monthIndex, 9); // October
  assert.equal(sydneyComponents.day, 27);
  assert.equal(sydneyComponents.hour, 15);
  assert.equal(sydneyComponents.minute, 30);

  // At 3:30 PM Sydney time:
  // 3:00 PM slot is expired
  assert.equal(frontendIsSlotPast('Tuesday, 27 October 2026', '3:00 PM', utcDate), true);
  // 4:00 PM slot is NOT expired
  assert.equal(frontendIsSlotPast('Tuesday, 27 October 2026', '4:00 PM', utcDate), false);
});

test('8. Midnight transition in Sydney: Date rollover', () => {
  // 2026-10-27 23:59:00 Sydney
  const beforeMidnight = DateTime.fromISO('2026-10-27T23:59:00', { zone: SYDNEY_ZONE });
  const dateStrToday = 'Tuesday, 27 October 2026';
  assert.equal(getTodaySydneyDateString(new Date(beforeMidnight.toMillis())), dateStrToday);

  // 2026-10-28 00:01:00 Sydney (midnight passed)
  const afterMidnight = DateTime.fromISO('2026-10-28T00:01:00', { zone: SYDNEY_ZONE });
  const dateStrTomorrow = 'Wednesday, 28 October 2026';
  assert.equal(getTodaySydneyDateString(new Date(afterMidnight.toMillis())), dateStrTomorrow);

  // The previous day is now in the past
  assert.equal(
    frontendIsSlotPast(dateStrToday, '5:00 PM', new Date(afterMidnight.toMillis())),
    true,
    'Yesterday 5:00 PM is now expired after midnight transition'
  );
});
