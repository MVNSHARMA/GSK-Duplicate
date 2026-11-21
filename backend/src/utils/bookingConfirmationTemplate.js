/**
 * Booking request / booking confirmation email (customer-facing).
 *
 * Design rules:
 *  - Every dynamic value is HTML-escaped (customer-supplied data is never trusted).
 *  - Table-based layout + inline CSS for broad email-client support (Gmail, Outlook, Apple Mail, mobile).
 *  - No image is required to understand the email (text wordmark header).
 *  - Only contact details passed in by the caller are rendered; nothing is invented here.
 *  - Never exposes internal IDs, admin notes, or credentials.
 */

const BRAND_RED = '#e53e3e';
const TEXT_DARK = '#111827';
const TEXT_MUTED = '#6b7280';
const BORDER = '#e5e7eb';

export const escapeHtml = (value) => {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

/** Strip CR/LF and control chars so values are safe in a subject line. */
export const sanitizeHeader = (value) => String(value ?? '').replace(/[\r\n\t\u0000-\u001f]+/g, ' ').trim();

/** Escape + preserve line breaks for multi-line customer notes. */
const escapeMultiline = (value) => escapeHtml(value).replace(/\r?\n/g, '<br>');

const STATUS_COPY = {
    pending: {
        title: 'We\u2019ve Received Your Booking Request',
        badge: 'Awaiting Approval',
        badgeBg: '#fef3c7',
        badgeFg: '#92400e',
        statusLabel: 'Pending \u2013 awaiting approval',
        intro: (biz) => `Thank you for choosing ${biz}. We\u2019ve received your booking request and our team will review it shortly.`,
        note: 'Your appointment is <strong>not yet confirmed</strong>. We\u2019ll contact you to confirm the time, or to suggest an alternative if the requested slot is unavailable.',
        noteText: 'Your appointment is NOT YET CONFIRMED. We will contact you to confirm the time, or to suggest an alternative if the requested slot is unavailable.'
    },
    confirmed: {
        title: 'Your Booking Is Confirmed',
        badge: 'Confirmed',
        badgeBg: '#dcfce7',
        badgeFg: '#166534',
        statusLabel: 'Confirmed',
        intro: (biz) => `Thank you for choosing ${biz}. Your booking is confirmed and we look forward to seeing you.`,
        note: 'Please arrive a few minutes before your appointment time.',
        noteText: 'Please arrive a few minutes before your appointment time.'
    }
};

export const buildBookingSubject = ({ statusKind, bookingReference, businessName }) => {
    const biz = sanitizeHeader(businessName || 'GSK Automotive');
    const ref = bookingReference ? ` (Ref: ${sanitizeHeader(bookingReference)})` : '';
    const lead = statusKind === 'confirmed' ? 'Your Booking Is Confirmed' : 'Booking Request Received';
    return `${lead}${ref} \u2013 ${biz}`;
};

const detailRow = (label, valueHtml) => `
<tr>
  <td class="gsk-label" style="padding:10px 12px 10px 0;width:38%;vertical-align:top;font-size:13px;color:${TEXT_MUTED};font-family:Arial,Helvetica,sans-serif;border-bottom:1px solid ${BORDER};">${escapeHtml(label)}</td>
  <td class="gsk-value" style="padding:10px 0;vertical-align:top;font-size:14px;color:${TEXT_DARK};font-weight:bold;font-family:Arial,Helvetica,sans-serif;border-bottom:1px solid ${BORDER};">${valueHtml}</td>
</tr>`;

/**
 * @param {object} m - prepared, authoritative model (see EmailService.buildBookingEmailModel)
 */
export const buildBookingConfirmationHtml = (m) => {
    const copy = STATUS_COPY[m.statusKind] || STATUS_COPY.pending;
    const biz = escapeHtml(m.businessName || 'GSK Automotive');
    const greetingName = m.customerName ? escapeHtml(m.customerName) : 'there';

    const vehicleBlocks = (m.vehicles || []).map((v, i) => {
        const heading = m.vehicles.length > 1
            ? `<tr><td colspan="2" style="padding:16px 0 4px 0;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:${BRAND_RED};font-weight:bold;font-family:Arial,Helvetica,sans-serif;">Vehicle ${i + 1}</td></tr>`
            : '';
        const services = v.services.length
            ? v.services.map(s => escapeHtml(s)).join('<br>')
            : 'General inspection';
        const importRows = v.importInfo
            ? [
                v.importInfo.vin ? detailRow('VIN / Chassis number', escapeHtml(v.importInfo.vin)) : '',
                v.importInfo.countryOfOrigin ? detailRow('Country of origin', escapeHtml(v.importInfo.countryOfOrigin)) : '',
                v.importInfo.approvalStatus ? detailRow('Import approval status', escapeHtml(v.importInfo.approvalStatus)) : '',
                v.importInfo.additionalInfo ? detailRow('Import notes', `<span style="font-weight:normal;">${escapeMultiline(v.importInfo.additionalInfo)}</span>`) : ''
            ].join('')
            : '';
        return `${heading}
${v.description ? detailRow('Vehicle', escapeHtml(v.description)) : ''}
${v.rego ? detailRow('Registration', escapeHtml(v.rego)) : ''}
${detailRow(v.services.length > 1 ? 'Services requested' : 'Service requested', services)}
${importRows}`;
    }).join('');

    const contactLines = [];
    if (m.contact?.phone) contactLines.push(`Phone: <a href="tel:${escapeHtml(m.contact.phone.replace(/[^\d+]/g, ''))}" style="color:${BRAND_RED};text-decoration:none;">${escapeHtml(m.contact.phone)}</a>`);
    if (m.contact?.email) contactLines.push(`Email: <a href="mailto:${escapeHtml(m.contact.email)}" style="color:${BRAND_RED};text-decoration:none;">${escapeHtml(m.contact.email)}</a>`);
    if (m.contact?.address) contactLines.push(escapeHtml(m.contact.address));

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<title>${escapeHtml(copy.title)}</title>
<style>
  @media only screen and (max-width: 620px) {
    .gsk-container { width: 100% !important; }
    .gsk-pad { padding-left: 20px !important; padding-right: 20px !important; }
    .gsk-label, .gsk-value { display: block !important; width: 100% !important; box-sizing: border-box; }
    .gsk-label { padding: 10px 0 2px 0 !important; border-bottom: 0 !important; }
    .gsk-value { padding: 0 0 10px 0 !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(copy.title)}${m.bookingReference ? ` \u2013 Ref ${escapeHtml(m.bookingReference)}` : ''}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f4f6;">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" class="gsk-container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#ffffff;border-radius:10px;overflow:hidden;border:1px solid ${BORDER};">
    <tr><td style="background-color:${TEXT_DARK};padding:20px 32px;" class="gsk-pad">
      <span style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:bold;color:#ffffff;letter-spacing:0.5px;">${biz}</span>
    </td></tr>
    <tr><td style="height:4px;background-color:${BRAND_RED};line-height:4px;font-size:0;">&nbsp;</td></tr>

    <tr><td class="gsk-pad" style="padding:32px 32px 8px 32px;font-family:Arial,Helvetica,sans-serif;">
      <span style="display:inline-block;background-color:${copy.badgeBg};color:${copy.badgeFg};font-size:12px;font-weight:bold;padding:4px 10px;border-radius:999px;text-transform:uppercase;letter-spacing:0.5px;">${escapeHtml(copy.badge)}</span>
      <h1 style="margin:16px 0 0 0;font-size:22px;line-height:1.3;color:${TEXT_DARK};font-weight:bold;">${escapeHtml(copy.title)}</h1>
    </td></tr>

    <tr><td class="gsk-pad" style="padding:16px 32px 0 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#374151;">
      <p style="margin:0 0 12px 0;">Hi ${greetingName},</p>
      <p style="margin:0 0 16px 0;">${escapeHtml(copy.intro(m.businessName || 'GSK Automotive'))}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="background-color:${m.statusKind === 'confirmed' ? '#f0fdf4' : '#fffbeb'};border-left:4px solid ${m.statusKind === 'confirmed' ? '#16a34a' : '#f59e0b'};padding:12px 14px;font-size:14px;line-height:1.5;color:#374151;font-family:Arial,Helvetica,sans-serif;">${copy.note}</td>
      </tr></table>
    </td></tr>

    <tr><td class="gsk-pad" style="padding:24px 32px 8px 32px;">
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:${TEXT_MUTED};font-weight:bold;padding-bottom:6px;border-bottom:2px solid ${TEXT_DARK};">Booking details</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${m.bookingReference ? detailRow('Booking reference', `<span style="font-family:'Courier New',Courier,monospace;color:${BRAND_RED};">${escapeHtml(m.bookingReference)}</span>`) : ''}
        ${m.customerName ? detailRow('Customer', escapeHtml(m.customerName)) : ''}
        ${detailRow('Appointment date', escapeHtml(m.appointmentDate || 'To be confirmed'))}
        ${detailRow('Appointment time', escapeHtml(m.appointmentTime || 'To be confirmed') + (m.timezoneLabel ? `<br><span style="font-weight:normal;font-size:12px;color:${TEXT_MUTED};">${escapeHtml(m.timezoneLabel)}</span>` : ''))}
        ${detailRow('Status', escapeHtml(copy.statusLabel))}
        ${vehicleBlocks}
        ${m.additionalInfo ? detailRow('Your notes', `<span style="font-weight:normal;">${escapeMultiline(m.additionalInfo)}</span>`) : ''}
      </table>
    </td></tr>

    <tr><td class="gsk-pad" style="padding:20px 32px 28px 32px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#374151;">
      <p style="margin:0 0 12px 0;">If any of these details are incorrect, or you need to change or cancel your booking, simply reply to this email${contactLines.length ? ' or contact us using the details below' : ''}${m.bookingReference ? ' and quote your booking reference' : ''}.</p>
      <p style="margin:0;">Kind regards,<br><strong>The ${biz} Team</strong></p>
    </td></tr>

    <tr><td class="gsk-pad" style="background-color:#f9fafb;border-top:1px solid ${BORDER};padding:20px 32px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:${TEXT_MUTED};">
      <strong style="color:${TEXT_DARK};">${biz}</strong>${contactLines.length ? '<br>' + contactLines.join('<br>') : ''}
      <br><span style="font-size:12px;">You are receiving this email because a booking request was submitted with this email address.</span>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
};

export const buildBookingConfirmationText = (m) => {
    const copy = STATUS_COPY[m.statusKind] || STATUS_COPY.pending;
    const biz = m.businessName || 'GSK Automotive';
    const lines = [];
    lines.push(copy.title.toUpperCase(), '='.repeat(copy.title.length), '');
    lines.push(`Hi ${m.customerName || 'there'},`, '');
    lines.push(copy.intro(biz), '');
    lines.push(copy.noteText, '');
    lines.push('BOOKING DETAILS');
    if (m.bookingReference) lines.push(`Booking reference: ${m.bookingReference}`);
    if (m.customerName) lines.push(`Customer: ${m.customerName}`);
    lines.push(`Appointment date: ${m.appointmentDate || 'To be confirmed'}`);
    lines.push(`Appointment time: ${m.appointmentTime || 'To be confirmed'}${m.timezoneLabel ? ` (${m.timezoneLabel})` : ''}`);
    lines.push(`Status: ${copy.statusLabel}`);
    (m.vehicles || []).forEach((v, i) => {
        lines.push('');
        if (m.vehicles.length > 1) lines.push(`Vehicle ${i + 1}`);
        if (v.description) lines.push(`Vehicle: ${v.description}`);
        if (v.rego) lines.push(`Registration: ${v.rego}`);
        lines.push(`Service(s) requested: ${v.services.length ? v.services.join(', ') : 'General inspection'}`);
        if (v.importInfo) {
            if (v.importInfo.vin) lines.push(`VIN / Chassis number: ${v.importInfo.vin}`);
            if (v.importInfo.countryOfOrigin) lines.push(`Country of origin: ${v.importInfo.countryOfOrigin}`);
            if (v.importInfo.approvalStatus) lines.push(`Import approval status: ${v.importInfo.approvalStatus}`);
            if (v.importInfo.additionalInfo) lines.push(`Import notes: ${v.importInfo.additionalInfo}`);
        }
    });
    if (m.additionalInfo) lines.push('', `Your notes: ${m.additionalInfo}`);
    lines.push('');
    lines.push(`If any of these details are incorrect, or you need to change or cancel your booking, reply to this email${m.bookingReference ? ' and quote your booking reference' : ''}.`);
    lines.push('', 'Kind regards,', `The ${biz} Team`);
    const contact = [m.contact?.phone && `Phone: ${m.contact.phone}`, m.contact?.email && `Email: ${m.contact.email}`, m.contact?.address].filter(Boolean);
    if (contact.length) lines.push('', ...contact);
    return lines.join('\n');
};
