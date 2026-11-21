import { resolveBusinessAddress, resolveBusinessPhone } from './businessInfo.js';

export const buildBaseTemplate = (settings, content) => {
    const FRONTEND_URL = process.env.FRONTEND_URL || 'https://gskautomotive.vercel.app';
    // Use the Cloudinary public URL as a reliable fallback for email clients that block localhost images
    const LOGO_URL = settings?.logoUrl || 'https://res.cloudinary.com/jcwekxzb/image/upload/v1787642177/gsk-automotive/assets/logo.png';
    const BRAND_COLOR = '#e53e3e';
    const businessName = settings?.businessName || 'GSK Automotive';
    const businessAddress = resolveBusinessAddress(settings);
    const businessPhone = resolveBusinessPhone(settings);
    const businessEmail = settings?.businessEmail || 'contact@gskautomotive.com';

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); }
        .header { text-align: center; padding: 30px 20px; border-bottom: 1px solid #f3f4f6; }
        .header img { max-height: 60px; height: auto; width: auto; max-width: 250px; }
        .content { padding: 40px 30px; color: #1f2937; line-height: 1.6; font-size: 16px; }
        .footer { background-color: #f9fafb; padding: 30px; text-align: center; color: #6b7280; font-size: 14px; border-top: 1px solid #f3f4f6; }
        .footer p { margin: 5px 0; }
        .btn { display: inline-block; background-color: ${BRAND_COLOR}; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; margin-top: 20px; text-align: center; }
        .card { background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 25px 0; }
        .card-header { font-size: 12px; font-weight: bold; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 15px; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; }
        .info-row { display: table; width: 100%; margin-bottom: 10px; }
        .info-label { display: table-cell; width: 120px; color: #6b7280; font-size: 14px; font-weight: 500; }
        .info-value { display: table-cell; color: #111827; font-weight: 600; font-size: 14px; }
        h1, h2, h3 { color: #111827; margin-top: 0; }
        h2 { font-size: 20px; margin-bottom: 20px; }
        a { color: ${BRAND_COLOR}; text-decoration: none; }
        table.invoice-table { width: 100%; border-collapse: collapse; margin-top: 20px; margin-bottom: 20px; font-size: 14px; }
        table.invoice-table th, table.invoice-table td { border-bottom: 1px solid #e5e7eb; padding: 10px; text-align: left; }
        table.invoice-table th { color: #6b7280; font-weight: 500; }
        table.invoice-table td.right, table.invoice-table th.right { text-align: right; }
        .totals-row { font-weight: bold; }
        @media (max-width: 640px) {
            .container { margin: 20px 10px; border-radius: 8px; }
            .content { padding: 25px 20px; }
            .info-row, .info-label, .info-value { display: block; width: 100%; }
            .info-label { margin-bottom: 2px; }
            .info-value { margin-bottom: 10px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <img src="${LOGO_URL}" alt="${businessName} Logo">
        </div>
        <div class="content">
            ${content}
        </div>
        <div class="footer">
            <p><strong>${businessName}</strong></p>
            <p>${businessAddress}</p>
            <p>Phone: ${businessPhone} | Email: ${businessEmail}</p>
            <p style="margin-top: 15px; font-size: 12px; color: #9ca3af;">This is an automated message, but you can reply directly to reach our team.</p>
        </div>
    </div>
</body>
</html>
`;
};

// ==========================================
// 1. CUSTOMER CONFIRMATION EMAILS
// ==========================================

export const buildServiceRequestConfirmation = (settings, { customerName, vehicleYear, vehicleMake, vehicleModel, date, time }) => {
    return buildBaseTemplate(settings, `
        <h2>Service Request Confirmed</h2>
        <p>Hi ${customerName},</p>
        <p>Thank you for choosing ${settings?.businessName || 'GSK Automotive'}. We have received your booking request. Our team will review the details and get back to you shortly to confirm your appointment.</p>
        
        <div class="card">
            <div class="card-header">Service Details</div>
            <div class="info-row">
                <div class="info-label">Date</div>
                <div class="info-value">${date}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Time</div>
                <div class="info-value">${time}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Vehicle</div>
                <div class="info-value">${vehicleYear || ''} ${vehicleMake || ''} ${vehicleModel || ''}</div>
            </div>
        </div>
        
        <p>If you need to make any changes or have immediate questions, please feel free to reply to this email or contact us.</p>
    `);
};

export const buildQuoteRequestConfirmation = (settings, { customerName, vehicleYear, vehicleMake, vehicleModel }) => {
    return buildBaseTemplate(settings, `
        <h2>Quote Request Received</h2>
        <p>Hi ${customerName},</p>
        <p>Thank you for reaching out to ${settings?.businessName || 'GSK Automotive'}. We have received your request for a quote regarding your <strong>${vehicleYear || ''} ${vehicleMake || ''} ${vehicleModel || ''}</strong>.</p>
        
        <p>Our team of expert mechanics is reviewing the details you provided. We will prepare a comprehensive estimate and get back to you as soon as possible.</p>
        
        <p>If there's any additional information you'd like to provide, simply reply to this email.</p>
    `);
};

export const buildAdminReply = (settings, { customerName, subject, originalMessage, replyMessage }) => {
    const originalMessageBlock = originalMessage ? `
        <div style="border-left: 4px solid #e53e3e; padding: 15px; margin-top: 30px; border-radius: 4px; background-color: #f9fafb;">
            <p style="margin-top: 0; color: #6b7280; font-size: 12px; margin-bottom: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">YOUR ORIGINAL MESSAGE</p>
            <div style="color: #4b5563; font-size: 14px; white-space: pre-wrap; font-style: italic; line-height: 1.5;">${originalMessage}</div>
        </div>
    ` : '';

    return buildBaseTemplate(settings, `
        <h2 style="margin-bottom: 25px; color: #111827;">${subject}</h2>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">Hello <strong>${customerName}</strong>,</p>
        <div style="font-size: 16px; color: #1f2937; line-height: 1.6; white-space: pre-wrap; margin-bottom: 30px;">${replyMessage}</div>
        ${originalMessageBlock}
    `);
};

// ==========================================
// 2. INTERNAL NOTIFICATION EMAILS
// ==========================================

export const buildInternalNotification = (settings, { title, type, customer, vehicle, details }) => {
    let detailsHtml = '';
    if (details && Object.keys(details).length > 0) {
        detailsHtml = '<div class="card"><div class="card-header">Request Details</div>';
        for (const [key, value] of Object.entries(details)) {
            if (value) {
                detailsHtml += `
                <div class="info-row">
                    <div class="info-label">${key}</div>
                    <div class="info-value" style="white-space: pre-wrap;">${value}</div>
                </div>`;
            }
        }
        detailsHtml += '</div>';
    }

    return buildBaseTemplate(settings, `
        <h2>${title}</h2>
        <p>A new ${type} has been submitted through the website.</p>
        
        <div class="card">
            <div class="card-header">Customer Details</div>
            <div class="info-row">
                <div class="info-label">Name</div>
                <div class="info-value">${customer?.name || (customer?.firstName && customer?.lastName ? customer.firstName + ' ' + customer.lastName : 'N/A')} ${customer?.customerType ? `(${customer.customerType})` : ''}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Email</div>
                <div class="info-value">${customer?.email || 'N/A'}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Phone</div>
                <div class="info-value">${customer?.phone || 'N/A'}</div>
            </div>
        </div>

        ${vehicle ? `
        <div class="card">
            <div class="card-header">Vehicle Details</div>
            <div class="info-row">
                <div class="info-label">Vehicle</div>
                <div class="info-value">${vehicle.year || ''} ${vehicle.make || vehicle.brand || ''} ${vehicle.model || ''}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Rego No</div>
                <div class="info-value">${vehicle.regNo || vehicle.registrationNumber || 'N/A'}</div>
            </div>
        </div>
        ` : ''}

        ${detailsHtml}
        
        <div style="text-align: center; margin-top: 30px;">
            <a href="${process.env.FRONTEND_URL || 'https://gskautomotive.vercel.app'}/admin" class="btn">VIEW IN DASHBOARD</a>
        </div>
    `);
};

// ==========================================
// 3. REMINDERS & THANK YOU
// ==========================================

export const buildServiceReminder = (settings, { customerName, vehicleDetails, date, time, isSameDay }) => {
    const title = isSameDay ? "Your Service Is Scheduled for Today" : "Service Reminder";
    const dayText = isSameDay ? "today" : "tomorrow";
    
    return buildBaseTemplate(settings, `
        <h2>${title}</h2>
        <p>Hi ${customerName},</p>
        <p>This is a friendly reminder that your vehicle (<strong>${vehicleDetails}</strong>) is scheduled for service ${dayText}.</p>
        
        <div class="card">
            <div class="card-header">Appointment Details</div>
            <div class="info-row">
                <div class="info-label">Date</div>
                <div class="info-value">${date}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Time</div>
                <div class="info-value">${time}</div>
            </div>
        </div>
        
        <p>If you need to reschedule or have any questions, please contact us at ${escapeHtml(resolveBusinessPhone(settings))} as soon as possible.</p>
        <p>We look forward to seeing you!</p>
    `);
};

export const buildThankYouEmail = (settings, { customerName, vehicleDetails, servicesPerformed }) => {
    return buildBaseTemplate(settings, `
        <h2>Thank You for Visiting ${settings?.businessName || 'GSK Automotive'}</h2>
        <p>Hi ${customerName},</p>
        <p>Thank you for trusting us with your <strong>${vehicleDetails}</strong>. Your service is now complete.</p>
        
        ${servicesPerformed ? `
        <div class="card">
            <div class="card-header">Service Performed</div>
            <div style="color: #111827; font-size: 14px;">
                ${servicesPerformed}
            </div>
        </div>
        ` : ''}
        
        <p>We appreciate your business. If you have any feedback or if there's anything else we can do for you, please don't hesitate to reach out.</p>
        <p>Safe driving!</p>
    `);
};

// ==========================================
// 4. INVOICES
// ==========================================

export const buildInvoiceEmail = (settings, { invoiceNo, date, customer, vehicle, partsAndLabour, subtotal, gstRate, tax, total, terms, paymentStatus, amountPaid }) => {
    let rowsHtml = '';
    
    if (partsAndLabour && partsAndLabour.length > 0) {
        rowsHtml = partsAndLabour.map(item => `
            <tr>
                <td>${item.description || 'Service/Part'}</td>
                <td class="right">${item.qty}</td>
                <td class="right">$${(item.price || 0).toFixed(2)}</td>
                <td class="right">$${(item.qty * (item.price || 0)).toFixed(2)}</td>
            </tr>
        `).join('');
    } else {
        rowsHtml = `<tr><td colspan="4">No items specified.</td></tr>`;
    }

    const statusBadge = paymentStatus === 'Paid' 
        ? '<span style="display:inline-block;background-color:#dcfce7;color:#16a34a;padding:4px 12px;border-radius:4px;font-weight:bold;font-size:12px;text-transform:uppercase;letter-spacing:1px;">PAID</span>'
        : '<span style="display:inline-block;background-color:#fef2f2;color:#dc2626;padding:4px 12px;border-radius:4px;font-weight:bold;font-size:12px;text-transform:uppercase;letter-spacing:1px;">UNPAID</span>';

    return buildBaseTemplate(settings, `
        <h2>Your Invoice: ${invoiceNo}</h2>
        <p>Hi ${customer?.name || 'Customer'},</p>
        <p>Please find the details of your invoice below.</p>
        
        <div class="card">
            <div class="info-row">
                <div class="info-label">Invoice #</div>
                <div class="info-value">${invoiceNo}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Date</div>
                <div class="info-value">${date}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Status</div>
                <div class="info-value">${statusBadge}</div>
            </div>
            ${customer ? `
            <div class="info-row">
                <div class="info-label">Customer</div>
                <div class="info-value">${customer.name || 'N/A'}${customer.phone ? ' — ' + customer.phone : ''}</div>
            </div>
            ` : ''}
            ${vehicle ? `
            <div class="info-row">
                <div class="info-label">Vehicle</div>
                <div class="info-value">${vehicle.year || ''} ${vehicle.brand || ''} ${vehicle.model || ''} (Rego No: ${vehicle.registrationNumber || 'N/A'})</div>
            </div>
            ` : ''}
        </div>
        
        <h3>Invoice Breakdown</h3>
        <table class="invoice-table">
            <thead>
                <tr>
                    <th>Description</th>
                    <th class="right">Qty</th>
                    <th class="right">Unit Price</th>
                    <th class="right">Total</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHtml}
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="3" class="right"><strong>Subtotal</strong></td>
                    <td class="right">$${subtotal.toFixed(2)}</td>
                </tr>
                <tr>
                    <td colspan="3" class="right"><strong>GST (${gstRate !== undefined ? gstRate : (settings?.gstRate || 10)}%)</strong></td>
                    <td class="right">$${tax.toFixed(2)}</td>
                </tr>
                <tr class="totals-row">
                    <td colspan="3" class="right"><strong>Total Amount</strong></td>
                    <td class="right">$${total.toFixed(2)}</td>
                </tr>
                ${amountPaid > 0 ? `
                <tr>
                    <td colspan="3" class="right" style="color: #16a34a;"><strong>Amount Paid</strong></td>
                    <td class="right" style="color: #16a34a;">-$${amountPaid.toFixed(2)}</td>
                </tr>
                <tr class="totals-row">
                    <td colspan="3" class="right"><strong>Balance Due</strong></td>
                    <td class="right" style="color: ${(total - amountPaid) > 0 ? '#dc2626' : '#16a34a'};">$${Math.max(0, total - amountPaid).toFixed(2)}</td>
                </tr>
                ` : ''}
            </tfoot>
        </table>
        
        ${terms ? `
        <div style="margin-top: 30px; font-size: 12px; color: #6b7280; padding-top: 15px; border-top: 1px solid #e5e7eb;">
            <strong>Terms & Conditions:</strong><br/>
            ${terms.replace(/\\n/g, '<br/>')}
        </div>
        ` : ''}
        
        <div style="text-align: center; margin-top: 30px; padding: 20px; background-color: #f9fafb; border-radius: 8px;">
            <p style="margin: 0; color: #374151; font-size: 16px;">Thank you for choosing <strong>${settings?.businessName || 'GSK Automotive'}</strong>!</p>
            <p style="margin: 5px 0 0; color: #6b7280; font-size: 14px;">We appreciate your business.</p>
        </div>
    `);
};

// ==========================================
// 5. AUTHENTICATION (PASSWORD RESET)
// ==========================================

export const buildAuthEmail = (settings, { title, customerName, message, actionText, actionUrl }) => {
    const actionBlock = actionUrl && actionText ? `
        <div style="text-align: center; margin-top: 30px;">
            <a href="${actionUrl}" class="btn">${actionText}</a>
        </div>
        <p style="font-size: 12px; color: #9ca3af; margin-top: 20px; text-align: center; word-break: break-all;">
            Or copy and paste this link into your browser:<br/>
            <a href="${actionUrl}" style="color: #9ca3af; text-decoration: underline;">${actionUrl}</a>
        </p>
    ` : '';

    return buildBaseTemplate(settings, `
        <h2>${title}</h2>
        <p>Hello ${customerName},</p>
        <p>${message}</p>
        ${actionBlock}
        <p style="font-size: 12px; color: #6b7280; margin-top: 30px;">If you didn't request this action, you can safely ignore this email.</p>
    `);
};

// ==========================================
// 6. SUPPLIER PURCHASE ORDER EMAILS
// ==========================================

export const escapeHtml = (value) => {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

const formatPODate = (value, fallback = 'Not specified') => {
    if (!value) return fallback;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return fallback;
    return d.toLocaleDateString('en-AU', {
        year: 'numeric',
        month: 'short',
        day: '2-digit'
    });
};

export const buildPurchaseOrderSubject = (poNumber) =>
    `Purchase Order #${poNumber || 'N/A'} – GSK Automotive`;

export const buildPurchaseOrderEmail = (settings = {}, { po, supplier }) => {
    const LOGO_URL = settings?.logoUrl || 'https://res.cloudinary.com/jcwekxzb/image/upload/v1787642177/gsk-automotive/assets/logo.png';
    const businessName = escapeHtml(settings?.businessName || 'GSK Automotive');
    const businessLegal = 'Baba Tarandas Pty Ltd T/A GSK Automotive (ABN: 13 165 526 143)';
    const businessAddress = escapeHtml(resolveBusinessAddress(settings));
    const businessPhone = escapeHtml(resolveBusinessPhone(settings));
    const businessEmail = escapeHtml(settings?.businessEmail || process.env.BREVO_SENDER_EMAIL || 'info@gskautomotive.com.au');

    const poNumber = escapeHtml(po?.purchaseOrderNumber || 'N/A');
    const issueDate = escapeHtml(formatPODate(po?.orderedAt || po?.createdAt));
    const expectedDelivery = escapeHtml(formatPODate(po?.expectedDeliveryDate, 'As agreed / To be advised'));
    const statusLabel = escapeHtml(po?.status || 'Ordered');

    const supplierName = escapeHtml(supplier?.name || 'Valued Supplier');
    const supplierContact = supplier?.contactPerson ? escapeHtml(supplier.contactPerson) : '';
    const supplierEmail = escapeHtml(supplier?.email || '');
    const supplierPhone = supplier?.phone ? escapeHtml(supplier.phone) : '';
    const supplierAddress = supplier?.address ? escapeHtml(supplier.address) : '';

    const gstRate = po?.gstRate !== undefined && po?.gstRate !== null ? Number(po.gstRate) : 10;
    const subtotal = Number(po?.subtotal || 0);
    const discountAmount = Number(po?.discountAmount || 0);
    const taxAmount = Number(po?.taxAmount || 0);
    const shippingAmount = Number(po?.shippingAmount || 0);
    const totalAmount = Number(po?.totalAmount || 0);
    const currency = 'AUD';

    const items = Array.isArray(po?.items) ? po.items : [];
    const itemsRowsHtml = items.length > 0
        ? items.map((item) => {
            const itemName = escapeHtml(item.productName || 'Item');
            const itemDesc = escapeHtml(item.hierarchyPath || item.variantName || '—');
            const itemSku = escapeHtml(item.sku || '—');
            const qty = Number(item.quantityOrdered || 0);
            const unitPrice = Number(item.unitPurchasePrice || 0);
            const lineSubtotal = qty * unitPrice;
            const lineTax = (lineSubtotal * gstRate) / 100;
            return `
                <tr>
                    <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #111827;">${itemName}</td>
                    <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; color: #4b5563;">${itemDesc}</td>
                    <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; color: #374151; font-family: monospace;">${itemSku}</td>
                    <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #111827;">${qty}</td>
                    <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #111827;">$${unitPrice.toFixed(2)}</td>
                    <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #4b5563;">${gstRate}% ($${lineTax.toFixed(2)})</td>
                    <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #6b7280;">$0.00</td>
                    <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 700; color: #111827;">$${lineSubtotal.toFixed(2)}</td>
                </tr>
            `;
        }).join('')
        : `<tr><td colspan="8" style="padding: 14px; text-align: center; color: #6b7280;">No items listed.</td></tr>`;

    const notesHtml = po?.notes && String(po.notes).trim()
        ? `
            <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
                <div style="font-size: 12px; font-weight: 700; color: #4b5563; text-transform: uppercase; margin-bottom: 4px;">Shipping Instructions &amp; Additional Notes</div>
                <div style="font-size: 14px; color: #1f2937; white-space: pre-wrap;">${escapeHtml(String(po.notes).trim())}</div>
            </div>
        `
        : '';

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 0; color: #1f2937; }
        .po-wrapper { max-width: 760px; margin: 30px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); border: 1px solid #e5e7eb; }
        .po-header { padding: 28px 30px; background: #111827; color: #ffffff; display: flex; justify-content: space-between; align-items: center; }
        .po-banner { background-color: #dc2626; color: #ffffff; padding: 14px 30px; font-size: 14px; font-weight: 700; letter-spacing: 0.5px; }
        .po-body { padding: 30px; }
        .grid-2 { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 24px; }
        .info-box { background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; vertical-align: top; }
        .box-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #dc2626; margin: 0 0 10px 0; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
        .po-table { width: 100%; border-collapse: collapse; font-size: 13px; margin: 16px 0 24px 0; }
        .po-table th { background-color: #1f2937; color: #ffffff; padding: 10px 8px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
        .po-footer { background-color: #f9fafb; padding: 24px 30px; text-align: center; color: #6b7280; font-size: 12px; border-top: 1px solid #e5e7eb; }
        @media (max-width: 640px) {
            .po-wrapper { margin: 10px; }
            .po-body { padding: 18px; }
            .po-table { font-size: 11px; }
        }
    </style>
</head>
<body>
    <div class="po-wrapper">
        <!-- A. HEADER -->
        <div style="padding: 24px 30px; border-bottom: 3px solid #dc2626; background-color: #ffffff;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="vertical-align: middle;">
                        <img src="${LOGO_URL}" alt="${businessName} Logo" style="max-height: 54px; width: auto; display: block;" />
                        <div style="font-size: 12px; color: #6b7280; margin-top: 6px;">${businessLegal}</div>
                    </td>
                    <td style="text-align: right; vertical-align: middle;">
                        <div style="font-size: 22px; font-weight: 800; color: #dc2626; letter-spacing: 0.5px;">PURCHASE ORDER</div>
                        <div style="font-size: 15px; font-weight: 700; color: #111827; margin-top: 4px;">Order #${poNumber}</div>
                        <div style="font-size: 12px; color: #4b5563; margin-top: 2px;">Issue Date: <strong>${issueDate}</strong></div>
                        <div style="font-size: 12px; color: #1d4ed8; font-weight: 700; margin-top: 2px;">Status: ${statusLabel}</div>
                    </td>
                </tr>
            </table>
        </div>

        <div class="po-body">
            <p style="margin-top: 0; font-size: 15px; color: #1f2937;">
                Dear <strong>${supplierContact || supplierName}</strong>,
            </p>
            <p style="font-size: 14px; color: #374151; line-height: 1.6;">
                Please find below our official Purchase Order <strong>#${poNumber}</strong> from <strong>${businessName}</strong>. A PDF copy of this purchase order is also attached for your records.
            </p>

            <!-- B. SUPPLIER INFORMATION & C. BUYER INFORMATION -->
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <tr>
                    <td style="width: 49%; vertical-align: top; padding-right: 8px;">
                        <div class="info-box">
                            <div class="box-title">Supplier Information</div>
                            <div style="font-size: 14px; font-weight: 700; color: #111827; margin-bottom: 4px;">${supplierName}</div>
                            ${supplierContact ? `<div style="font-size: 13px; color: #374151; margin-bottom: 3px;"><strong>Contact Person:</strong> ${supplierContact}</div>` : ''}
                            <div style="font-size: 13px; color: #374151; margin-bottom: 3px;"><strong>Email:</strong> ${supplierEmail}</div>
                            ${supplierPhone ? `<div style="font-size: 13px; color: #374151; margin-bottom: 3px;"><strong>Phone:</strong> ${supplierPhone}</div>` : ''}
                            ${supplierAddress ? `<div style="font-size: 13px; color: #374151;"><strong>Address:</strong> ${supplierAddress}</div>` : ''}
                        </div>
                    </td>
                    <td style="width: 49%; vertical-align: top; padding-left: 8px;">
                        <div class="info-box">
                            <div class="box-title">Buyer Information</div>
                            <div style="font-size: 14px; font-weight: 700; color: #111827; margin-bottom: 4px;">${businessName}</div>
                            <div style="font-size: 12px; color: #4b5563; margin-bottom: 4px;">${businessLegal}</div>
                            <div style="font-size: 13px; color: #374151; margin-bottom: 3px;"><strong>Address:</strong> ${businessAddress}</div>
                            <div style="font-size: 13px; color: #374151; margin-bottom: 3px;"><strong>Phone:</strong> ${businessPhone}</div>
                            <div style="font-size: 13px; color: #374151;"><strong>Email:</strong> ${businessEmail}</div>
                        </div>
                    </td>
                </tr>
            </table>

            <!-- D. PURCHASE ORDER DETAILS TABLE -->
            <h3 style="font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #111827; margin: 24px 0 8px 0;">
                Purchase Order Line Items
            </h3>
            <div style="overflow-x: auto;">
                <table class="po-table">
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th>Description</th>
                            <th>SKU / Part #</th>
                            <th style="text-align: right;">Quantity</th>
                            <th style="text-align: right;">Unit Price</th>
                            <th style="text-align: right;">Tax</th>
                            <th style="text-align: right;">Discount</th>
                            <th style="text-align: right;">Line Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsRowsHtml}
                    </tbody>
                </table>
            </div>

            <!-- E. FINANCIAL SUMMARY -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                <tr>
                    <td style="width: 50%;"></td>
                    <td style="width: 50%;">
                        <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px;">
                            <div class="box-title">Financial Summary (${currency})</div>
                            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                                <tr>
                                    <td style="padding: 4px 0; color: #4b5563;">Subtotal (excl. GST):</td>
                                    <td style="padding: 4px 0; text-align: right; font-weight: 600; color: #111827;">$${subtotal.toFixed(2)}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 4px 0; color: #4b5563;">Discount:</td>
                                    <td style="padding: 4px 0; text-align: right; color: #111827;">$${discountAmount.toFixed(2)}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 4px 0; color: #4b5563;">Tax / GST (${gstRate}%):</td>
                                    <td style="padding: 4px 0; text-align: right; font-weight: 600; color: #111827;">$${taxAmount.toFixed(2)}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 4px 0; color: #4b5563;">Shipping / Additional Charges:</td>
                                    <td style="padding: 4px 0; text-align: right; color: #111827;">$${shippingAmount.toFixed(2)}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px 0 4px 0; border-top: 2px solid #111827; font-size: 15px; font-weight: 800; color: #111827;">Grand Total (${currency}):</td>
                                    <td style="padding: 10px 0 4px 0; border-top: 2px solid #111827; text-align: right; font-size: 16px; font-weight: 800; color: #dc2626;">$${totalAmount.toFixed(2)} ${currency}</td>
                                </tr>
                            </table>
                        </div>
                    </td>
                </tr>
            </table>

            <!-- F. DELIVERY INFORMATION -->
            <div class="info-box" style="margin-bottom: 24px;">
                <div class="box-title">Delivery Information</div>
                <div style="font-size: 13px; color: #374151; margin-bottom: 4px;">
                    <strong>Delivery Address:</strong> ${businessAddress}
                </div>
                <div style="font-size: 13px; color: #374151;">
                    <strong>Expected Delivery Date:</strong> ${expectedDelivery}
                </div>
                ${notesHtml}
            </div>

            <!-- G. CLOSING -->
            <p style="font-size: 14px; color: #374151; line-height: 1.6; margin-bottom: 20px;">
                Please acknowledge receipt of this Purchase Order by replying to this email, and kindly communicate any concerns regarding stock availability, pricing, or delivery timelines at your earliest convenience.
            </p>

            <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 14px; color: #111827;">
                <strong>GSK Automotive</strong><br />
                <span style="color: #4b5563;">Purchasing / Procurement Team</span>
            </div>
        </div>

        <div class="po-footer">
            <p style="margin: 4px 0;"><strong>${businessName}</strong> — ${businessAddress}</p>
            <p style="margin: 4px 0;">Phone: ${businessPhone} | Email: ${businessEmail}</p>
        </div>
    </div>
</body>
</html>
`;
};

export const buildPurchaseOrderText = (settings = {}, { po, supplier }) => {
    const businessName = settings?.businessName || 'GSK Automotive';
    const businessAddress = resolveBusinessAddress(settings);
    const businessPhone = resolveBusinessPhone(settings);
    const businessEmail = settings?.businessEmail || process.env.BREVO_SENDER_EMAIL || 'info@gskautomotive.com.au';

    const poNumber = po?.purchaseOrderNumber || 'N/A';
    const issueDate = formatPODate(po?.orderedAt || po?.createdAt);
    const expectedDelivery = formatPODate(po?.expectedDeliveryDate, 'As agreed / To be advised');
    const gstRate = po?.gstRate !== undefined && po?.gstRate !== null ? Number(po.gstRate) : 10;
    const subtotal = Number(po?.subtotal || 0);
    const discountAmount = Number(po?.discountAmount || 0);
    const taxAmount = Number(po?.taxAmount || 0);
    const shippingAmount = Number(po?.shippingAmount || 0);
    const totalAmount = Number(po?.totalAmount || 0);

    const itemLines = (po?.items || []).map((item, idx) => {
        const desc = item.hierarchyPath || item.variantName || '—';
        const sku = item.sku || '—';
        const qty = Number(item.quantityOrdered || 0);
        const unitPrice = Number(item.unitPurchasePrice || 0);
        const lineSubtotal = qty * unitPrice;
        return `${idx + 1}. ${item.productName} | Description: ${desc} | SKU: ${sku} | Qty: ${qty} | Unit Price: $${unitPrice.toFixed(2)} | Tax: ${gstRate}% | Discount: $0.00 | Line Total: $${lineSubtotal.toFixed(2)}`;
    }).join('\n');

    return [
        `PURCHASE ORDER #${poNumber} – ${businessName}`,
        `Issue Date: ${issueDate}`,
        `Status: ${po?.status || 'Ordered'}`,
        '',
        'SUPPLIER INFORMATION:',
        `Supplier: ${supplier?.name || 'Valued Supplier'}`,
        supplier?.contactPerson ? `Contact Person: ${supplier.contactPerson}` : null,
        `Email: ${supplier?.email || ''}`,
        supplier?.phone ? `Phone: ${supplier.phone}` : null,
        supplier?.address ? `Address: ${supplier.address}` : null,
        '',
        'BUYER INFORMATION:',
        `Company: ${businessName} (Baba Tarandas Pty Ltd, ABN: 13 165 526 143)`,
        `Address: ${businessAddress}`,
        `Phone: ${businessPhone}`,
        `Email: ${businessEmail}`,
        '',
        'PURCHASE ORDER DETAILS:',
        itemLines || 'No line items.',
        '',
        'FINANCIAL SUMMARY (AUD):',
        `Subtotal: $${subtotal.toFixed(2)}`,
        `Discount: $${discountAmount.toFixed(2)}`,
        `Tax / GST (${gstRate}%): $${taxAmount.toFixed(2)}`,
        `Shipping / Additional Charges: $${shippingAmount.toFixed(2)}`,
        `Grand Total: $${totalAmount.toFixed(2)} AUD`,
        '',
        'DELIVERY INFORMATION:',
        `Delivery Address: ${businessAddress}`,
        `Expected Delivery Date: ${expectedDelivery}`,
        po?.notes ? `Notes / Instructions: ${po.notes}` : null,
        '',
        'Please acknowledge receipt of this Purchase Order and communicate any concerns regarding availability or delivery timelines.',
        '',
        'GSK Automotive',
        'Purchasing / Procurement Team'
    ].filter(line => line !== null).join('\n');
};

// ==========================================
// 7. CONSOLIDATED INVOICES EMAIL (SINGLE & MULTI-INVOICE)
// ==========================================

export const computeAuthoritativeInvoiceAmounts = (invoice, settings = {}) => {
    const subtotal = invoice?.subtotal !== undefined && invoice?.subtotal !== null
        ? Number(invoice.subtotal)
        : (invoice?.partsAndLabour?.reduce((sum, item) => sum + ((Number(item.qty) || 1) * (Number(item.price) || 0)), 0) || 0);
    const gstRate = invoice?.gstRate !== undefined && invoice?.gstRate !== null
        ? Number(invoice.gstRate)
        : (settings?.gstRate !== undefined ? Number(settings.gstRate) : 10);
    const gstAmount = invoice?.gstAmount !== undefined && invoice?.gstAmount !== null
        ? Number(invoice.gstAmount)
        : Number(((subtotal * gstRate) / 100).toFixed(2));
    const totalAmount = invoice?.totalAmount !== undefined && invoice?.totalAmount !== null
        ? Number(invoice.totalAmount)
        : Number((subtotal + gstAmount).toFixed(2));
    const amountPaid = invoice?.status === 'Paid'
        ? totalAmount
        : Number(invoice?.amountPaid || 0);
    const balanceDue = Math.max(0, Number((totalAmount - amountPaid).toFixed(2)));

    return {
        subtotal: Number(subtotal.toFixed(2)),
        gstRate,
        gstAmount: Number(gstAmount.toFixed(2)),
        totalAmount: Number(totalAmount.toFixed(2)),
        amountPaid: Number(amountPaid.toFixed(2)),
        balanceDue
    };
};

export const buildInvoiceSummaryDescription = (invoice) => {
    const vehicle = invoice?.vehicleId || invoice?.trackerCarId || null;
    const rego = vehicle?.registrationNumber || '';
    const makeModel = [vehicle?.year, vehicle?.brand || vehicle?.make, vehicle?.model].filter(Boolean).join(' ').trim();
    const vehicleLabel = rego
        ? `${makeModel ? `${makeModel} ` : ''}(Rego: ${rego})`
        : makeModel;

    const itemDescriptions = Array.isArray(invoice?.partsAndLabour)
        ? invoice.partsAndLabour.map(i => (i?.description || '').trim()).filter(Boolean)
        : [];
    const itemsPreview = itemDescriptions.length > 0
        ? itemDescriptions.slice(0, 2).join(', ') + (itemDescriptions.length > 2 ? ` (+${itemDescriptions.length - 2} more)` : '')
        : (invoice?.type || 'Service Invoice');

    if (vehicleLabel && itemsPreview) {
        return `${vehicleLabel} — ${itemsPreview}`;
    }
    return vehicleLabel || itemsPreview || invoice?.type || 'Service Invoice';
};

export const buildConsolidatedInvoiceSubject = (customerName, businessName = 'GSK Automotive') => {
    const cleanCustomer = String(customerName || 'Valued Customer').trim();
    const cleanBusiness = String(businessName || 'GSK Automotive').trim();
    return `Your Invoices – ${cleanBusiness} – ${cleanCustomer}`;
};

export const buildConsolidatedInvoiceEmail = (settings = {}, { customer, invoices = [], attachmentFilenames = [] }) => {
    const LOGO_URL = settings?.logoUrl || 'https://res.cloudinary.com/jcwekxzb/image/upload/v1787642177/gsk-automotive/assets/logo.png';
    const businessName = escapeHtml(settings?.businessName || 'GSK Automotive');
    const businessAddress = escapeHtml(resolveBusinessAddress(settings));
    const businessPhone = escapeHtml(resolveBusinessPhone(settings));
    const businessEmail = escapeHtml(settings?.businessEmail || process.env.BREVO_SENDER_EMAIL || 'gsksevenhill@gmail.com');

    const customerName = escapeHtml(customer?.name || 'Valued Customer');
    const invoiceCount = invoices.length;

    let combinedSubtotal = 0;
    let combinedGst = 0;
    let combinedTotal = 0;
    let combinedPaid = 0;
    let combinedBalanceDue = 0;

    const rowsHtml = invoices.map((inv) => {
        const amounts = computeAuthoritativeInvoiceAmounts(inv, settings);
        combinedSubtotal += amounts.subtotal;
        combinedGst += amounts.gstAmount;
        combinedTotal += amounts.totalAmount;
        combinedPaid += amounts.amountPaid;
        combinedBalanceDue += amounts.balanceDue;

        const invoiceNo = escapeHtml(inv.invoiceNo || 'N/A');
        const invoiceDate = formatPODate(inv.createdAt, 'N/A');
        const dueDate = inv.dueDate
            ? formatPODate(inv.dueDate, 'Upon Receipt')
            : (inv.status === 'Paid' ? 'Paid' : 'Upon Receipt');
        const description = escapeHtml(buildInvoiceSummaryDescription(inv));
        const statusBadge = inv.status === 'Paid'
            ? '<span style="display:inline-block;background:#dcfce7;color:#15803d;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:700;text-transform:uppercase;margin-left:6px;">Paid</span>'
            : '<span style="display:inline-block;background:#fef2f2;color:#dc2626;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:700;text-transform:uppercase;margin-left:6px;">Unpaid</span>';

        return `
            <tr>
                <td style="padding:11px 10px;border-bottom:1px solid #e5e7eb;font-weight:700;color:#111827;font-size:13px;white-space:nowrap;">
                    ${invoiceNo}${statusBadge}
                </td>
                <td style="padding:11px 10px;border-bottom:1px solid #e5e7eb;color:#374151;font-size:13px;white-space:nowrap;">${escapeHtml(invoiceDate)}</td>
                <td style="padding:11px 10px;border-bottom:1px solid #e5e7eb;color:#374151;font-size:13px;white-space:nowrap;">${escapeHtml(dueDate)}</td>
                <td style="padding:11px 10px;border-bottom:1px solid #e5e7eb;color:#4b5563;font-size:13px;">${description}</td>
                <td style="padding:11px 10px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:13px;font-weight:700;text-align:right;white-space:nowrap;">$${amounts.totalAmount.toFixed(2)}</td>
            </tr>
        `;
    }).join('');

    const combinedTotalFormatted = Number(combinedTotal.toFixed(2)).toFixed(2);
    const combinedSubtotalFormatted = Number(combinedSubtotal.toFixed(2)).toFixed(2);
    const combinedGstFormatted = Number(combinedGst.toFixed(2)).toFixed(2);
    const termsText = settings?.invoiceTerms
        ? escapeHtml(settings.invoiceTerms).replace(/\n/g, '<br/>')
        : '';

    const attachmentPillsHtml = attachmentFilenames.length > 0
        ? `
        <div style="margin-top:20px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px;">
            <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px;">
                Attached PDF Documents (${attachmentFilenames.length})
            </div>
            <div style="font-size:13px;color:#1f2937;line-height:1.8;">
                ${attachmentFilenames.map(fn => `<span style="display:inline-block;background:#ffffff;border:1px solid #d1d5db;border-radius:4px;padding:3px 9px;margin:2px 6px 2px 0;font-family:monospace;font-size:12px;">${escapeHtml(fn)}</span>`).join('')}
            </div>
        </div>`
        : '';

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your Invoices – ${businessName} – ${customerName}</title>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f3f4f6;margin:0;padding:0;color:#1f2937;">
    <div style="max-width:720px;margin:30px auto;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.08);border:1px solid #e5e7eb;">
        <!-- Header -->
        <div style="background-color:#111827;color:#ffffff;padding:26px 32px;border-bottom:4px solid #dc2626;">
            <table style="width:100%;border-collapse:collapse;">
                <tr>
                    <td style="vertical-align:middle;">
                        <img src="${LOGO_URL}" alt="${businessName}" style="max-height:50px;width:auto;display:block;margin-bottom:6px;" />
                        <div style="font-size:12px;color:#9ca3af;">Baba Tarandas Pty Ltd T/A ${businessName} &bull; ABN: 13 165 526 143</div>
                    </td>
                    <td style="vertical-align:middle;text-align:right;">
                        <div style="font-size:19px;font-weight:800;color:#ffffff;letter-spacing:0.6px;text-transform:uppercase;">INVOICE STATEMENT</div>
                        <div style="font-size:13px;color:#f87171;font-weight:700;margin-top:4px;">${invoiceCount} ${invoiceCount === 1 ? 'Invoice' : 'Invoices'} Attached</div>
                    </td>
                </tr>
            </table>
        </div>

        <!-- Content -->
        <div style="padding:30px 32px;line-height:1.6;font-size:15px;color:#1f2937;">
            <p style="margin-top:0;font-size:16px;color:#111827;">Dear <strong>${customerName}</strong>,</p>
            <p style="color:#374151;margin-bottom:22px;">
                Please find attached the following ${invoiceCount === 1 ? 'invoice' : 'invoices'} from <strong>${businessName}</strong> for your records and processing.
            </p>

            <!-- Summary Table -->
            <div style="font-size:12px;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:10px;">
                Invoice Summary
            </div>
            <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                <thead>
                    <tr style="background-color:#1f2937;color:#ffffff;">
                        <th style="padding:10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Invoice Number</th>
                        <th style="padding:10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Invoice Date</th>
                        <th style="padding:10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Due Date</th>
                        <th style="padding:10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Description</th>
                        <th style="padding:10px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>

            <!-- Financial Totals Summary -->
            <table style="width:100%;border-collapse:collapse;margin-top:18px;">
                <tr>
                    <td style="width:50%;vertical-align:top;padding-right:12px;">
                        <div style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px;font-size:13px;color:#374151;">
                            <div><strong>Total Invoices Attached:</strong> ${invoiceCount}</div>
                            <div style="margin-top:4px;"><strong>Currency:</strong> AUD ($)</div>
                            <div style="margin-top:4px;"><strong>Customer:</strong> ${customerName}</div>
                        </div>
                    </td>
                    <td style="width:50%;vertical-align:top;">
                        <table style="width:100%;border-collapse:collapse;background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                            <tr>
                                <td style="padding:8px 14px;font-size:13px;color:#4b5563;">Combined Subtotal (Excl. GST)</td>
                                <td style="padding:8px 14px;font-size:13px;color:#111827;font-weight:600;text-align:right;">$${combinedSubtotalFormatted}</td>
                            </tr>
                            <tr>
                                <td style="padding:8px 14px;font-size:13px;color:#4b5563;">Combined GST</td>
                                <td style="padding:8px 14px;font-size:13px;color:#111827;font-weight:600;text-align:right;">$${combinedGstFormatted}</td>
                            </tr>
                            <tr style="background-color:#111827;color:#ffffff;">
                                <td style="padding:11px 14px;font-size:14px;font-weight:700;">Combined Invoice Amount (AUD)</td>
                                <td style="padding:11px 14px;font-size:15px;font-weight:800;text-align:right;color:#f87171;">$${combinedTotalFormatted} AUD</td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>

            ${attachmentPillsHtml}

            ${termsText ? `
            <div style="margin-top:22px;padding:14px 16px;background-color:#f9fafb;border-left:4px solid #dc2626;border-radius:4px;font-size:12.5px;color:#4b5563;">
                <div style="font-weight:700;color:#111827;margin-bottom:4px;text-transform:uppercase;font-size:11px;letter-spacing:0.5px;">Terms &amp; Payment Information</div>
                ${termsText}
            </div>
            ` : ''}

            <!-- Closing -->
            <div style="margin-top:26px;padding-top:18px;border-top:1px solid #e5e7eb;font-size:14px;color:#374151;">
                <p style="margin:0 0 10px 0;">
                    Thank you for choosing <strong>${businessName}</strong>. If you have any questions regarding the attached ${invoiceCount === 1 ? 'invoice' : 'invoices'}, please contact our team using the details below or reply directly to this email.
                </p>
                <p style="margin:12px 0 0 0;font-weight:700;color:#111827;">${businessName}</p>
                <p style="margin:2px 0 0 0;font-size:13px;color:#6b7280;">Baba Tarandas Pty Ltd &bull; ABN: 13 165 526 143 &bull; MVRL61927</p>
                <p style="margin:2px 0 0 0;font-size:13px;color:#6b7280;">${businessAddress}</p>
                <p style="margin:2px 0 0 0;font-size:13px;color:#6b7280;">Phone: ${businessPhone} | 0410 433 851 &bull; Email: ${businessEmail}</p>
            </div>
        </div>

        <!-- Footer -->
        <div style="background-color:#f9fafb;padding:18px 32px;text-align:center;color:#6b7280;font-size:12px;border-top:1px solid #e5e7eb;">
            <p style="margin:3px 0;"><strong>${businessName}</strong> — ${businessAddress}</p>
            <p style="margin:3px 0;">Phone: ${businessPhone} | Email: ${businessEmail}</p>
        </div>
    </div>
</body>
</html>`;
};

export const buildConsolidatedInvoiceText = (settings = {}, { customer, invoices = [], attachmentFilenames = [] }) => {
    const businessName = settings?.businessName || 'GSK Automotive';
    const businessAddress = resolveBusinessAddress(settings);
    const businessPhone = resolveBusinessPhone(settings);
    const businessEmail = settings?.businessEmail || process.env.BREVO_SENDER_EMAIL || 'gsksevenhill@gmail.com';
    const customerName = customer?.name || 'Valued Customer';

    let combinedSubtotal = 0;
    let combinedGst = 0;
    let combinedTotal = 0;

    const lines = invoices.map((inv, idx) => {
        const amounts = computeAuthoritativeInvoiceAmounts(inv, settings);
        combinedSubtotal += amounts.subtotal;
        combinedGst += amounts.gstAmount;
        combinedTotal += amounts.totalAmount;

        const invoiceDate = formatPODate(inv.createdAt, 'N/A');
        const dueDate = inv.dueDate
            ? formatPODate(inv.dueDate, 'Upon Receipt')
            : (inv.status === 'Paid' ? 'Paid' : 'Upon Receipt');
        const desc = buildInvoiceSummaryDescription(inv);

        return `${idx + 1}. ${inv.invoiceNo} | Date: ${invoiceDate} | Due: ${dueDate} | ${desc} | Amount: $${amounts.totalAmount.toFixed(2)} AUD (${inv.status || 'Unpaid'})`;
    });

    return [
        `Your Invoices – ${businessName} – ${customerName}`,
        '',
        `Dear ${customerName},`,
        '',
        `Please find attached the following ${invoices.length === 1 ? 'invoice' : 'invoices'} from ${businessName} for your records and processing.`,
        '',
        'INVOICE SUMMARY:',
        ...lines,
        '',
        `Total Number of Invoices Attached: ${invoices.length}`,
        `Combined Subtotal (Excl. GST): $${combinedSubtotal.toFixed(2)} AUD`,
        `Combined GST: $${combinedGst.toFixed(2)} AUD`,
        `Combined Invoice Amount: $${combinedTotal.toFixed(2)} AUD`,
        `Currency: AUD`,
        attachmentFilenames.length > 0 ? `Attached PDFs: ${attachmentFilenames.join(', ')}` : null,
        settings?.invoiceTerms ? `\nTerms & Conditions:\n${settings.invoiceTerms}` : null,
        '',
        `Thank you for choosing ${businessName}. For any invoice-related queries, please contact us:`,
        `${businessName} (Baba Tarandas Pty Ltd, ABN: 13 165 526 143)`,
        `Address: ${businessAddress}`,
        `Phone: ${businessPhone} | 0410 433 851`,
        `Email: ${businessEmail}`
    ].filter(line => line !== null).join('\n');
};
