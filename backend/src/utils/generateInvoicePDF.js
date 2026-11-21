import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { resolveBusinessAddress, resolveBusinessPhone } from './businessInfo.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const generateInvoicePDF = (invoice, settings = {}) => {
    return new Promise(async (resolve, reject) => {
        try {
            const doc = new PDFDocument({ 
                margin: 40, 
                size: 'A4',
                autoFirstPage: true,
                bufferPages: true
            });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));

            const liveCustomer = (invoice.customerId && typeof invoice.customerId === 'object') ? invoice.customerId : {};
            const customer = (invoice.customerSnapshot && invoice.customerSnapshot.name && invoice.status !== 'Draft')
                ? { ...liveCustomer, ...invoice.customerSnapshot }
                : (Object.keys(liveCustomer).length > 0 ? liveCustomer : (invoice.customerSnapshot || {}));
            const liveVehicle = (invoice.vehicleId && typeof invoice.vehicleId === 'object')
                ? invoice.vehicleId
                : ((invoice.trackerCarId && typeof invoice.trackerCarId === 'object') ? invoice.trackerCarId : {});
            const vehicle = (invoice.vehicleSnapshot && invoice.vehicleSnapshot.registrationNumber && invoice.status !== 'Draft')
                ? { ...liveVehicle, ...invoice.vehicleSnapshot }
                : (Object.keys(liveVehicle).length > 0 ? liveVehicle : (invoice.vehicleSnapshot || {}));
            const isTrackerCar = !!invoice.trackerCarId && !invoice.vehicleId;

            // === Financial values from authoritative source ===
            const subtotal = invoice.subtotal !== undefined ? invoice.subtotal : (invoice.partsAndLabour?.reduce((sum, item) => sum + ((item.qty || 1) * (item.price || 0)), 0) || 0);
            const gstRate = invoice.gstRate !== undefined ? invoice.gstRate : (settings.gstRate || 10);
            const gstAmount = invoice.gstAmount !== undefined ? invoice.gstAmount : ((subtotal * gstRate) / 100);
            const total = invoice.totalAmount !== undefined ? invoice.totalAmount : (subtotal + gstAmount);

            const businessName = settings.businessName || 'GSK Automotive';
            const businessAddress = resolveBusinessAddress(settings);
            const businessPhone = resolveBusinessPhone(settings);
            const businessEmail = settings.businessEmail || 'gsksevenhill@gmail.com';

            // Page dimensions
            const pageWidth = 595.28;
            const pageHeight = 841.89;
            const marginLeft = 40;
            const marginRight = 40;
            const contentWidth = pageWidth - marginLeft - marginRight;
            const rightEdge = pageWidth - marginRight;

            // =============================================
            // HEADER — Logo left, company info right
            // =============================================
            const logoPath = path.join(__dirname, '..', 'assets', 'Logo.png');
            let logoExists = false;
            try { 
                fs.accessSync(logoPath); 
                logoExists = true; 
            } catch (e) { 
                logoExists = false; 
            }

            if (logoExists) {
                doc.image(logoPath, marginLeft, 30, { width: 90 });
            } else {
                doc.fontSize(18).font('Helvetica-Bold').fillColor('#dc2626').text('GSK', marginLeft, 35);
                doc.fontSize(8).font('Helvetica-Bold').fillColor('#1a1a1a').text('AUTOMOTIVE', marginLeft, 55);
            }

            // Company info — right-aligned
            const companyX = 300;
            const companyWidth = rightEdge - companyX;
            doc.fontSize(12).font('Helvetica-Bold').fillColor('#1a1a1a')
                .text('Baba Tarandas Pty Ltd', companyX, 30, { width: companyWidth, align: 'right' });
            doc.fontSize(10).font('Helvetica-Bold')
                .text(`T/A ${businessName}`, companyX, doc.y, { width: companyWidth, align: 'right' });
            doc.fontSize(8.5).font('Helvetica').fillColor('#4b5563')
                .text(`ABN: 13 165 526 143 | ACN: 165 526 143`, companyX, doc.y + 2, { width: companyWidth, align: 'right' });
            doc.text('MVRL: MVRL61927', companyX, doc.y, { width: companyWidth, align: 'right' });
            doc.text(businessAddress, companyX, doc.y, { width: companyWidth, align: 'right' });
            doc.text(`${businessPhone} | 0410 433 851`, companyX, doc.y, { width: companyWidth, align: 'right' });
            doc.fillColor('#dc2626').text(businessEmail, companyX, doc.y, { width: companyWidth, align: 'right', link: `mailto:${businessEmail}` });

            // =============================================
            // RED SERVICE INVOICE BAR
            // =============================================
            const invoiceBarY = 125;
            doc.rect(marginLeft, invoiceBarY, contentWidth, 32).fill('#dc2626');
            doc.fillColor('#ffffff').fontSize(15).font('Helvetica-Bold')
                .text('SERVICE INVOICE', marginLeft + 15, invoiceBarY + 9);
            doc.fillColor('#ffffff').fontSize(13).font('Helvetica-Bold')
                .text(invoice.invoiceNo || 'N/A', marginLeft + 15, invoiceBarY + 9, { width: contentWidth - 30, align: 'right' });

            // =============================================
            // DATE / STATUS ROW
            // =============================================
            const dateStatusY = invoiceBarY + 40;
            const dateStr = invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString('en-AU', { year: 'numeric', month: '2-digit', day: '2-digit' }) : 'N/A';
            doc.fillColor('#1a1a1a').fontSize(10).font('Helvetica-Bold')
                .text('Date: ', marginLeft, dateStatusY, { continued: true })
                .font('Helvetica').text(dateStr);
            
            const statusColor = invoice.status === 'Paid' ? '#16a34a' : '#dc2626';
            const statusText = (invoice.status || 'UNPAID').toUpperCase();
            doc.font('Helvetica-Bold').fillColor('#1a1a1a')
                .text('Status: ', rightEdge - 130, dateStatusY, { continued: true });
            doc.fillColor(statusColor).font('Helvetica-Bold').text(statusText);

            // =============================================
            // CUSTOMER DETAILS + VEHICLE DETAILS (side by side)
            // =============================================
            const cardsY = dateStatusY + 25;
            const cardWidth = (contentWidth - 15) / 2;
            const cardHeaderHeight = 22;
            const cardInnerWidth = cardWidth - 20; // 10px padding each side
            const labelWidth = 60;
            const valueWidth = cardInnerWidth - labelWidth - 5;
            const rowHeight = 15;

            // --- Build customer rows to calculate dynamic height ---
            const custRows = [];
            custRows.push({ label: 'Name:', value: customer.name || '—', bold: true });
            custRows.push({ label: 'Phone:', value: customer.phone || '—' });
            if (customer.email) {
                custRows.push({ label: 'Email:', value: customer.email });
            }
            custRows.push({ label: 'Address:', value: customer.address || '—' });

            // Calculate height needed for customer card
            doc.fontSize(9).font('Helvetica');
            let custContentHeight = 12; // top padding
            custRows.forEach(row => {
                const textHeight = doc.heightOfString(row.value, { width: valueWidth });
                custContentHeight += Math.max(rowHeight, textHeight + 3);
            });
            custContentHeight += 6; // bottom padding

            // --- Build vehicle rows ---
            const vehRows = [];
            const makeModel = `${vehicle.brand || vehicle.make || ''} ${vehicle.model || ''}`.trim();
            if (makeModel) {
                vehRows.push({ label: 'Make/Model:', value: makeModel + (isTrackerCar ? ' (Fleet Vehicle)' : ''), bold: true });
            }
            if (vehicle.registrationNumber) {
                vehRows.push({ label: 'Rego No:', value: vehicle.registrationNumber });
            } else {
                vehRows.push({ label: 'Rego No:', value: '—' });
            }
            
            if (vehicle.vin || vehicle.chassisNo) {
                vehRows.push({ label: 'VIN:', value: vehicle.vin || vehicle.chassisNo });
            }

            if (vehicle.mileage) {
                vehRows.push({ label: 'Odometer:', value: `${vehicle.mileage.toLocaleString()} km` });
            } else if (vehicle.finalOdometer) {
                vehRows.push({ label: 'Final Odometer:', value: `${vehicle.finalOdometer.toLocaleString()} km` });
            }
            
            if (vehicle.year) {
                vehRows.push({ label: 'Year:', value: String(vehicle.year) });
            }

            let vehContentHeight = 12;
            vehRows.forEach(row => {
                const textHeight = doc.heightOfString(row.value, { width: valueWidth });
                vehContentHeight += Math.max(rowHeight, textHeight + 3);
            });
            vehContentHeight += 6;

            // Use the taller of the two for visual balance
            const cardBodyHeight = Math.max(custContentHeight, vehContentHeight, 70);

            // --- CUSTOMER DETAILS (RED header) ---
            doc.rect(marginLeft, cardsY, cardWidth, cardHeaderHeight).fill('#dc2626');
            doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold')
                .text('CUSTOMER DETAILS', marginLeft + 10, cardsY + 6);

            doc.rect(marginLeft, cardsY + cardHeaderHeight, cardWidth, cardBodyHeight).stroke('#e5e5e5');

            let cy = cardsY + cardHeaderHeight + 8;
            custRows.forEach(row => {
                doc.fillColor('#6b7280').fontSize(8).font('Helvetica')
                    .text(row.label, marginLeft + 10, cy, { width: labelWidth });
                doc.fillColor('#1a1a1a').fontSize(9).font(row.bold ? 'Helvetica-Bold' : 'Helvetica')
                    .text(row.value, marginLeft + 10 + labelWidth, cy, { width: valueWidth });
                const textHeight = doc.heightOfString(row.value, { width: valueWidth });
                cy += Math.max(rowHeight, textHeight + 3);
            });

            // --- VEHICLE DETAILS (BLACK header) ---
            const vehCardX = marginLeft + cardWidth + 15;
            doc.rect(vehCardX, cardsY, cardWidth, cardHeaderHeight).fill('#1a1a1a');
            doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold')
                .text('VEHICLE DETAILS', vehCardX + 10, cardsY + 6);

            doc.rect(vehCardX, cardsY + cardHeaderHeight, cardWidth, cardBodyHeight).stroke('#e5e5e5');

            let vy = cardsY + cardHeaderHeight + 8;
            vehRows.forEach(row => {
                doc.fillColor('#6b7280').fontSize(8).font('Helvetica')
                    .text(row.label, vehCardX + 10, vy, { width: labelWidth });
                doc.fillColor('#1a1a1a').fontSize(9).font(row.bold ? 'Helvetica-Bold' : 'Helvetica')
                    .text(row.value, vehCardX + 10 + labelWidth, vy, { width: valueWidth });
                const textHeight = doc.heightOfString(row.value, { width: valueWidth });
                vy += Math.max(rowHeight, textHeight + 3);
            });

            let currentYPos = cardsY + cardHeaderHeight + cardBodyHeight + 12;

            // =============================================
            // SERVICE WORK COMPLETED (conditional)
            // =============================================
            const hasChecklist = invoice.checklist && invoice.checklist.length > 0;
            const hasNotes = invoice.notes && invoice.notes.trim();

            if (hasChecklist || hasNotes) {
                if (currentYPos > 680) { doc.addPage(); currentYPos = 40; }

                doc.rect(marginLeft, currentYPos, contentWidth, cardHeaderHeight).fill('#1a1a1a');
                doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold')
                    .text('SERVICE WORK COMPLETED', marginLeft + 10, currentYPos + 6);

                currentYPos += cardHeaderHeight + 8;
                doc.fillColor('#4b5563').font('Helvetica-Oblique').fontSize(9);
                doc.text('All work completed as per manufacturer specifications.', marginLeft + 10, currentYPos);
                currentYPos += 16;

                doc.fillColor('#1a1a1a').font('Helvetica').fontSize(9);
                if (hasChecklist) {
                    invoice.checklist.forEach(item => {
                        doc.text(`✔ ${item}`, marginLeft + 10, currentYPos);
                        currentYPos += 14;
                    });
                }
                if (hasNotes) {
                    currentYPos += 2;
                    doc.text(invoice.notes, marginLeft + 10, currentYPos, { width: contentWidth - 20 });
                    currentYPos += doc.heightOfString(invoice.notes, { width: contentWidth - 20 }) + 5;
                }
                currentYPos += 10;
            }

            // =============================================
            // PARTS & LABOUR TABLE
            // =============================================
            if (currentYPos > 580) { doc.addPage(); currentYPos = 40; }

            doc.rect(marginLeft, currentYPos, contentWidth, cardHeaderHeight).fill('#1a1a1a');
            doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold')
                .text('PARTS & LABOUR', marginLeft + 10, currentYPos + 6);
            currentYPos += cardHeaderHeight;

            // Table header row
            const colDesc = marginLeft;
            const colQty = marginLeft + 300;
            const colPrice = marginLeft + 370;
            const colAmount = marginLeft + 445;

            doc.rect(marginLeft, currentYPos, contentWidth, 20).fill('#f3f4f6');
            doc.fillColor('#374151').font('Helvetica-Bold').fontSize(8.5);
            doc.text('Description', colDesc + 10, currentYPos + 6, { width: 280 });
            doc.text('Qty', colQty, currentYPos + 6, { width: 50, align: 'center' });
            doc.text('Unit Price', colPrice, currentYPos + 6, { width: 65, align: 'right' });
            doc.text('Amount', colAmount, currentYPos + 6, { width: 65, align: 'right' });
            currentYPos += 22;

            // Table data rows
            doc.font('Helvetica').fontSize(9).fillColor('#1a1a1a');
            if (invoice.partsAndLabour && invoice.partsAndLabour.length > 0) {
                invoice.partsAndLabour.forEach(item => {
                    if (currentYPos > 700) {
                        doc.addPage();
                        currentYPos = 40;
                        // Re-draw table header on new page
                        doc.rect(marginLeft, currentYPos, contentWidth, 20).fill('#f3f4f6');
                        doc.fillColor('#374151').font('Helvetica-Bold').fontSize(8.5);
                        doc.text('Description', colDesc + 10, currentYPos + 6, { width: 280 });
                        doc.text('Qty', colQty, currentYPos + 6, { width: 50, align: 'center' });
                        doc.text('Unit Price', colPrice, currentYPos + 6, { width: 65, align: 'right' });
                        doc.text('Amount', colAmount, currentYPos + 6, { width: 65, align: 'right' });
                        currentYPos += 22;
                        doc.font('Helvetica').fontSize(9).fillColor('#1a1a1a');
                    }

                    const qty = item.qty || 1;
                    const price = item.price || 0;
                    const amount = qty * price;

                    // Calculate description height for wrapping
                    const descHeight = doc.heightOfString(item.description || '', { width: 280 });
                    const lineRowHeight = Math.max(18, descHeight + 6);

                    doc.font('Helvetica').text(item.description || '', colDesc + 10, currentYPos, { width: 280 });
                    doc.text(qty.toString(), colQty, currentYPos, { width: 50, align: 'center' });
                    doc.text(`$${Number(price).toFixed(2)}`, colPrice, currentYPos, { width: 65, align: 'right' });
                    doc.font('Helvetica-Bold').text(`$${amount.toFixed(2)}`, colAmount, currentYPos, { width: 65, align: 'right' });
                    doc.font('Helvetica');

                    currentYPos += lineRowHeight;
                    doc.moveTo(marginLeft, currentYPos - 3).lineTo(rightEdge, currentYPos - 3).lineWidth(0.5).stroke('#e5e7eb');
                });
            } else {
                doc.fillColor('#9ca3af').text('No parts or labour listed.', marginLeft + 10, currentYPos);
                currentYPos += 18;
            }

            currentYPos += 8;

            // =============================================
            // TOTALS
            // =============================================
            if (currentYPos > 680) { doc.addPage(); currentYPos = 40; }

            const totalsLabelX = colPrice - 20;
            const totalsValueX = colAmount;
            const totalsValueWidth = 65;

            doc.fillColor('#1a1a1a').font('Helvetica-Bold').fontSize(9);
            doc.text('Subtotal:', totalsLabelX, currentYPos, { width: 80, align: 'right' });
            doc.font('Helvetica').text(`$${subtotal.toFixed(2)}`, totalsValueX, currentYPos, { width: totalsValueWidth, align: 'right' });
            currentYPos += 16;

            doc.font('Helvetica-Bold').text(`GST (${gstRate}%):`, totalsLabelX, currentYPos, { width: 80, align: 'right' });
            doc.font('Helvetica').text(`$${gstAmount.toFixed(2)}`, totalsValueX, currentYPos, { width: totalsValueWidth, align: 'right' });
            currentYPos += 16;

            // Separator before total
            doc.moveTo(totalsLabelX, currentYPos - 3).lineTo(rightEdge, currentYPos - 3).lineWidth(1).stroke('#1a1a1a');
            currentYPos += 4;

            doc.fillColor('#1a1a1a').font('Helvetica-Bold').fontSize(12);
            doc.text('TOTAL DUE:', totalsLabelX - 30, currentYPos, { width: 110, align: 'right' });
            doc.text(`$${total.toFixed(2)}`, totalsValueX, currentYPos, { width: totalsValueWidth, align: 'right' });
            currentYPos += 25;

            // =============================================
            // RECOMMENDATIONS (conditional, orange header)
            // =============================================
            if (invoice.recommendations && invoice.recommendations.length > 0) {
                if (currentYPos > 710) { doc.addPage(); currentYPos = 40; }

                doc.rect(marginLeft, currentYPos, contentWidth, cardHeaderHeight).fill('#f97316');
                doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold')
                    .text('RECOMMENDATIONS', marginLeft + 10, currentYPos + 6);
                currentYPos += cardHeaderHeight + 6;

                doc.fillColor('#1a1a1a').font('Helvetica').fontSize(9);
                invoice.recommendations.forEach(rec => {
                    doc.text(`● ${rec}`, marginLeft + 10, currentYPos, { width: contentWidth - 20 });
                    currentYPos += doc.heightOfString(`● ${rec}`, { width: contentWidth - 20 }) + 3;
                });
                currentYPos += 8;
            }

            // =============================================
            // TERMS AND CONDITIONS
            // =============================================
            if (currentYPos > 720) { doc.addPage(); currentYPos = 40; }

            // Separator line above terms
            doc.moveTo(marginLeft, currentYPos).lineTo(rightEdge, currentYPos).lineWidth(0.5).stroke('#d1d5db');
            currentYPos += 10;

            doc.fillColor('#1a1a1a').font('Helvetica-Bold').fontSize(9.5)
                .text('TERMS AND CONDITIONS', marginLeft, currentYPos);
            currentYPos += 16;

            doc.fillColor('#4b5563').font('Helvetica').fontSize(8);
            const defaultTerms = '• All work carried out with due care and skill.\n• Parts used may be OEM or equivalent quality.\n• Warranty applies to parts and labour as per workshop policy.\n• Customer advised of any additional work prior to completion.';
            const termsText = settings.invoiceTerms || defaultTerms;
            
            // Handle both single-line legacy and multi-line terms
            const termsLines = termsText.split('\n').filter(l => l.trim());
            termsLines.forEach(line => {
                const trimmed = line.trim();
                const displayLine = (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*')) 
                    ? trimmed : `• ${trimmed}`;
                doc.text(displayLine, marginLeft + 5, currentYPos, { width: contentWidth - 10 });
                currentYPos += 12;
            });

            currentYPos += 10;

            // =============================================
            // FOOTER — positioned after content, not fixed
            // =============================================
            // Place footer directly after content with some breathing room.
            // If content ends well above the bottom, add moderate spacing (not huge gap).
            // If content is near the bottom, keep it flowing.
            const footerHeight = 65; // actual footer is ~60pt (sep + text + sep + 2 lines)
            const pageBottom = pageHeight - 30; // 30pt bottom margin
            
            if (currentYPos + footerHeight > pageBottom) {
                // Footer won't fit — add page
                doc.addPage();
                currentYPos = 40;
            } else {
                // Add moderate spacing: at most 30pt gap, or whatever's left
                const maxGap = 30;
                const availableGap = pageBottom - footerHeight - currentYPos;
                currentYPos += Math.min(maxGap, Math.max(0, availableGap));
            }

            drawFooter(doc, marginLeft, rightEdge, contentWidth, currentYPos, businessName, businessAddress, businessPhone, businessEmail);

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
};

function drawFooter(doc, marginLeft, rightEdge, contentWidth, startY, businessName, businessAddress, businessPhone, businessEmail) {
    // Separator line
    doc.moveTo(marginLeft, startY).lineTo(rightEdge, startY).lineWidth(0.5).stroke('#dc2626');
    startY += 10;

    // Thank you message
    doc.fillColor('#dc2626').font('Helvetica-Bold').fontSize(11)
        .text(`Thank you for choosing ${businessName}!`, marginLeft, startY, { width: contentWidth, align: 'center' });
    startY += 18;

    // Company details
    doc.moveTo(marginLeft, startY).lineTo(rightEdge, startY).lineWidth(0.5).stroke('#dc2626');
    startY += 8;

    doc.fillColor('#6b7280').font('Helvetica').fontSize(7.5);
    doc.text(`Baba Tarandas Pty Ltd | ABN 13 165 526 143 | ${businessAddress}`, 
        marginLeft, startY, { width: contentWidth, align: 'center' });
    doc.text(`${businessPhone} | 0410 433 851 | ${businessEmail}`, 
        marginLeft, startY + 10, { width: contentWidth, align: 'center' });
}
