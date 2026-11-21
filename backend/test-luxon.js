import { DateTime } from 'luxon';

const dateStr = "Monday, 24 August 2026";
const timeStr = "9:00 AM";

const parsedDate = DateTime.fromFormat(dateStr, 'EEEE, d MMMM yyyy', { zone: 'Australia/Sydney' });
const parsedTime = DateTime.fromFormat(timeStr, 'h:mm a', { zone: 'Australia/Sydney' });

const targetDateTime = parsedDate.set({
    hour: parsedTime.hour,
    minute: parsedTime.minute,
    second: 0,
    millisecond: 0
});

const nowSydney = DateTime.now().setZone('Australia/Sydney');

console.log("Target:", targetDateTime.toString());
console.log("Now:", nowSydney.toString());
console.log("Is Past?", targetDateTime < nowSydney);
