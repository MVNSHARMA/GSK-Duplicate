import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { resolveBusinessAddress, resolveBusinessPhone } from './businessInfo.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const formatDateAU = (value, fallback = 'Not specified') => {
    if (!value) return fallback;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return fallback;
    return d.toLocaleDateString('en-AU', {
        year: 'numeric',
        month: 'short',
        day: '2-digit'
    });
};

export const generatePurchaseOrderPDF = (po, supplier = {}, settings = {}) => {
    return new Promise((resolve, reject) => {
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
            doc.on('error', reject);

            // Authoritative financial values from stored PO
            const gstRate = po.gstRate !== undefined && po.gstRate !== null ? Number(po.gstRate) : 10;
            const subtotal = Number(po.subtotal || 0);
            const taxAmount = Number(po.taxAmount || 0);
            const discountAmount = Number(po.discountAmount || 0);
            const shippingAmount = Number(po.shippingAmount || 0);
            const totalAmount = Number(po.totalAmount || 0);

            const businessName = settings.businessName || 'GSK Automotive';
            const businessAddress = resolveBusinessAddress(settings);
            const businessPhone = resolveBusinessPhone(settings);
            const businessEmail = settings.businessEmail || process.env.BREVO_SENDER_EMAIL || 'info@gskautomotive.com.au';

            const pageWidth = 595.28;
            const pageHeight = 841.89;
            const marginLeft = 40;
            const marginRight = 40;
            const contentWidth = pageWidth - marginLeft - marginRight;
            const rightEdge = pageWidth - marginRight;

            // =============================================
            // A. HEADER — Logo left, Buyer company info right
            // =============================================
            const logoPath = path.join(__dirname, '..', 'assets', 'Logo.png');
            let logoExists = false;
            try {
                fs.accessSync(logoPath);
                logoExists = true;
            } catch (_) {
                logoExists = false;
            }

            if (logoExists) {
                doc.image(logoPath, marginLeft, 30, { width: 90 });
            } else {
                doc.fontSize(18).font('Helvetica-Bold').fillColor('#dc2626').text('GSK', marginLeft, 35);
                doc.fontSize(8).font('Helvetica-Bold').fillColor('#1a1a1a').text('AUTOMOTIVE', marginLeft, 55);
            }

            const companyX = 290;
            const companyWidth = rightEdge - companyX;
            doc.fontSize(11).font('Helvetica-Bold').fillColor('#1a1a1a')
                .text('Baba Tarandas Pty Ltd', companyX, 30, { width: companyWidth, align: 'right' });
            doc.fontSize(9.5).font('Helvetica-Bold')
                .text(`T/A ${businessName}`, companyX, doc.y, { width: companyWidth, align: 'right' });
            doc.fontSize(8).font('Helvetica').fillColor('#4b5563')
                .text('ABN: 13 165 526 143 | ACN: 165 526 143', companyX, doc.y + 2, { width: companyWidth, align: 'right' });
            doc.text(businessAddress, companyX, doc.y, { width: companyWidth, align: 'right' });
            doc.text(`Phone: ${businessPhone}`, companyX, doc.y, { width: companyWidth, align: 'right' });
            doc.fillColor('#dc2626').text(businessEmail, companyX, doc.y, { width: companyWidth, align: 'right' });

            // =============================================
            // PURCHASE ORDER BANNER
            // =============================================
            const bannerY = 120;
            doc.rect(marginLeft, bannerY, contentWidth, 32).fill('#dc2626');
            doc.fillColor('#ffffff').fontSize(14).font('Helvetica-Bold')
                .text('PURCHASE ORDER', marginLeft + 14, bannerY + 9);
            doc.fillColor('#ffffff').fontSize(13).font('Helvetica-Bold')
                .text(po.purchaseOrderNumber || 'PO', marginLeft + 14, bannerY + 9, {
                    width: contentWidth - 28,
                    align: 'right'
                });

            // Issue Date / Expected Delivery / Status Row
            const metaY = bannerY + 40;
            const issueDateStr = formatDateAU(po.orderedAt || po.createdAt);
            const expectedDeliveryStr = formatDateAU(po.expectedDeliveryDate, 'As agreed / To be advised');
            doc.fillColor('#1a1a1a').fontSize(9).font('Helvetica-Bold')
                .text('Issue Date: ', marginLeft, metaY, { continued: true })
                .font('Helvetica').text(`${issueDateStr}    `, { continued: true })
                .font('Helvetica-Bold').text('Expected Delivery: ', { continued: true })
                .font('Helvetica').text(expectedDeliveryStr);

            doc.font('Helvetica-Bold').fillColor('#1a1a1a')
                .text('Order Status: ', rightEdge - 150, metaY, { width: 150, align: 'right', continued: false });
            doc.font('Helvetica-Bold').fillColor('#1d4ed8')
                .text((po.status || 'Ordered').toUpperCase(), rightEdge - 150, metaY + 12, { width: 150, align: 'right' });

            // =============================================
            // B. SUPPLIER INFORMATION & C. BUYER / DELIVERY INFO
            // =============================================
            const cardsY = metaY + 30;
            const cardWidth = (contentWidth - 15) / 2;
            const cardHeaderHeight = 20;
            const labelWidth = 68;
            const valueWidth = cardWidth - 20 - labelWidth;
            const rowHeight = 14;

            const supplierRows = [
                { label: 'Supplier:', value: supplier.name || '—', bold: true },
                ...(supplier.contactPerson ? [{ label: 'Contact:', value: supplier.contactPerson }] : []),
                { label: 'Email:', value: supplier.email || '—' },
                ...(supplier.phone ? [{ label: 'Phone:', value: supplier.phone }] : []),
                ...(supplier.address ? [{ label: 'Address:', value: supplier.address }] : [])
            ];

            const buyerRows = [
                { label: 'Company:', value: businessName, bold: true },
                { label: 'Deliver To:', value: businessAddress },
                { label: 'Phone:', value: businessPhone },
                { label: 'Email:', value: businessEmail },
                { label: 'Expected:', value: expectedDeliveryStr }
            ];

            doc.fontSize(8.5).font('Helvetica');
            let supHeight = 12;
            supplierRows.forEach(r => {
                const h = doc.heightOfString(String(r.value), { width: valueWidth });
                supHeight += Math.max(rowHeight, h + 3);
            });
            supHeight += 6;

            let buyHeight = 12;
            buyerRows.forEach(r => {
                const h = doc.heightOfString(String(r.value), { width: valueWidth });
                buyHeight += Math.max(rowHeight, h + 3);
            });
            buyHeight += 6;

            const cardBodyHeight = Math.max(supHeight, buyHeight, 68);

            // Supplier Card
            doc.rect(marginLeft, cardsY, cardWidth, cardHeaderHeight).fill('#dc2626');
            doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold')
                .text('SUPPLIER INFORMATION', marginLeft + 10, cardsY + 6);
            doc.rect(marginLeft, cardsY + cardHeaderHeight, cardWidth, cardBodyHeight).stroke('#e5e7eb');

            let sy = cardsY + cardHeaderHeight + 8;
            supplierRows.forEach(r => {
                doc.fillColor('#6b7280').fontSize(8).font('Helvetica')
                    .text(r.label, marginLeft + 10, sy, { width: labelWidth });
                doc.fillColor('#111827').fontSize(8.5).font(r.bold ? 'Helvetica-Bold' : 'Helvetica')
                    .text(String(r.value), marginLeft + 10 + labelWidth, sy, { width: valueWidth });
                const h = doc.heightOfString(String(r.value), { width: valueWidth });
                sy += Math.max(rowHeight, h + 3);
            });

            // Buyer / Delivery Card
            const buyerCardX = marginLeft + cardWidth + 15;
            doc.rect(buyerCardX, cardsY, cardWidth, cardHeaderHeight).fill('#1f2937');
            doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold')
                .text('BUYER & DELIVERY INFORMATION', buyerCardX + 10, cardsY + 6);
            doc.rect(buyerCardX, cardsY + cardHeaderHeight, cardWidth, cardBodyHeight).stroke('#e5e7eb');

            let by = cardsY + cardHeaderHeight + 8;
            buyerRows.forEach(r => {
                doc.fillColor('#6b7280').fontSize(8).font('Helvetica')
                    .text(r.label, buyerCardX + 10, by, { width: labelWidth });
                doc.fillColor('#111827').fontSize(8.5).font(r.bold ? 'Helvetica-Bold' : 'Helvetica')
                    .text(String(r.value), buyerCardX + 10 + labelWidth, by, { width: valueWidth });
                const h = doc.heightOfString(String(r.value), { width: valueWidth });
                by += Math.max(rowHeight, h + 3);
            });

            let currentY = cardsY + cardHeaderHeight + cardBodyHeight + 16;

            // =============================================
            // D. PURCHASE ORDER LINE ITEMS TABLE
            // =============================================
            doc.rect(marginLeft, currentY, contentWidth, cardHeaderHeight).fill('#1f2937');
            doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold')
                .text('PURCHASE ORDER LINE ITEMS (AUD)', marginLeft + 10, currentY + 6);
            currentY += cardHeaderHeight;

            const cols = {
                item: { x: marginLeft + 6, w: 110 },
                desc: { x: marginLeft + 120, w: 110 },
                sku: { x: marginLeft + 234, w: 62 },
                qty: { x: marginLeft + 298, w: 32 },
                price: { x: marginLeft + 332, w: 52 },
                tax: { x: marginLeft + 386, w: 40 },
                disc: { x: marginLeft + 428, w: 34 },
                total: { x: marginLeft + 464, w: 45 }
            };

            const drawTableHeader = (y) => {
                doc.rect(marginLeft, y, contentWidth, 20).fill('#f3f4f6');
                doc.fillColor('#374151').font('Helvetica-Bold').fontSize(7.5);
                doc.text('Item', cols.item.x, y + 6, { width: cols.item.w });
                doc.text('Description', cols.desc.x, y + 6, { width: cols.desc.w });
                doc.text('SKU / Part #', cols.sku.x, y + 6, { width: cols.sku.w });
                doc.text('Qty', cols.qty.x, y + 6, { width: cols.qty.w, align: 'right' });
                doc.text('Unit Price', cols.price.x, y + 6, { width: cols.price.w, align: 'right' });
                doc.text('Tax', cols.tax.x, y + 6, { width: cols.tax.w, align: 'right' });
                doc.text('Disc.', cols.disc.x, y + 6, { width: cols.disc.w, align: 'right' });
                doc.text('Line Total', cols.total.x, y + 6, { width: cols.total.w, align: 'right' });
                return y + 23;
            };

            currentY = drawTableHeader(currentY);

            const items = Array.isArray(po.items) ? po.items : [];
            items.forEach(item => {
                const itemName = item.productName || 'Item';
                const itemDesc = item.hierarchyPath || item.variantName || '—';
                const itemSku = item.sku || '—';
                const qty = Number(item.quantityOrdered || 0);
                const unitPrice = Number(item.unitPurchasePrice || 0);
                const lineSubtotal = qty * unitPrice;

                doc.font('Helvetica').fontSize(8);
                const h1 = doc.heightOfString(itemName, { width: cols.item.w });
                const h2 = doc.heightOfString(itemDesc, { width: cols.desc.w });
                const h3 = doc.heightOfString(itemSku, { width: cols.sku.w });
                const rowH = Math.max(18, h1 + 6, h2 + 6, h3 + 6);

                if (currentY + rowH > 700) {
                    doc.addPage();
                    currentY = drawTableHeader(40);
                }

                doc.fillColor('#111827').font('Helvetica-Bold').fontSize(8)
                    .text(itemName, cols.item.x, currentY, { width: cols.item.w });
                doc.fillColor('#4b5563').font('Helvetica').fontSize(7.5)
                    .text(itemDesc, cols.desc.x, currentY, { width: cols.desc.w });
                doc.fillColor('#374151').font('Helvetica').fontSize(7.5)
                    .text(itemSku, cols.sku.x, currentY, { width: cols.sku.w });
                doc.fillColor('#111827').font('Helvetica').fontSize(8)
                    .text(String(qty), cols.qty.x, currentY, { width: cols.qty.w, align: 'right' });
                doc.text(`$${unitPrice.toFixed(2)}`, cols.price.x, currentY, { width: cols.price.w, align: 'right' });
                doc.text(`${gstRate}%`, cols.tax.x, currentY, { width: cols.tax.w, align: 'right' });
                doc.text('$0.00', cols.disc.x, currentY, { width: cols.disc.w, align: 'right' });
                doc.font('Helvetica-Bold')
                    .text(`$${lineSubtotal.toFixed(2)}`, cols.total.x, currentY, { width: cols.total.w, align: 'right' });

                currentY += rowH;
                doc.moveTo(marginLeft, currentY - 3).lineTo(rightEdge, currentY - 3).lineWidth(0.5).stroke('#e5e7eb');
            });

            currentY += 8;

            // =============================================
            // E. FINANCIAL SUMMARY
            // =============================================
            if (currentY > 650) {
                doc.addPage();
                currentY = 40;
            }

            const summaryLabelX = rightEdge - 200;
            const summaryValueX = rightEdge - 85;
            const summaryValueW = 85;

            const drawSummaryRow = (label, val, isBold = false) => {
                doc.fillColor('#374151').font(isBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(isBold ? 10.5 : 8.5)
                    .text(label, summaryLabelX, currentY, { width: 110, align: 'right' });
                doc.fillColor('#111827').font(isBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(isBold ? 10.5 : 8.5)
                    .text(val, summaryValueX, currentY, { width: summaryValueW, align: 'right' });
                currentY += isBold ? 18 : 14;
            };

            drawSummaryRow('Subtotal:', `$${subtotal.toFixed(2)}`);
            drawSummaryRow('Discount:', `$${discountAmount.toFixed(2)}`);
            drawSummaryRow(`Tax / GST (${gstRate}%):`, `$${taxAmount.toFixed(2)}`);
            drawSummaryRow('Shipping / Charges:', `$${shippingAmount.toFixed(2)}`);

            doc.moveTo(summaryLabelX, currentY - 2).lineTo(rightEdge, currentY - 2).lineWidth(1).stroke('#111827');
            currentY += 4;
            drawSummaryRow('Grand Total (AUD):', `$${totalAmount.toFixed(2)}`, true);

            currentY += 10;

            // =============================================
            // F. DELIVERY NOTES / INSTRUCTIONS & G. CLOSING
            // =============================================
            if (po.notes && String(po.notes).trim()) {
                if (currentY > 680) {
                    doc.addPage();
                    currentY = 40;
                }
                doc.rect(marginLeft, currentY, contentWidth, 18).fill('#f3f4f6');
                doc.fillColor('#111827').font('Helvetica-Bold').fontSize(8.5)
                    .text('SHIPPING INSTRUCTIONS & ADDITIONAL NOTES', marginLeft + 8, currentY + 5);
                currentY += 24;
                doc.fillColor('#374151').font('Helvetica').fontSize(8.5)
                    .text(String(po.notes).trim(), marginLeft + 8, currentY, { width: contentWidth - 16 });
                currentY += doc.heightOfString(String(po.notes).trim(), { width: contentWidth - 16 }) + 12;
            }

            if (currentY > 710) {
                doc.addPage();
                currentY = 40;
            }

            doc.moveTo(marginLeft, currentY).lineTo(rightEdge, currentY).lineWidth(0.5).stroke('#d1d5db');
            currentY += 10;
            doc.fillColor('#374151').font('Helvetica').fontSize(8.5)
                .text(
                    'Please acknowledge receipt of this Purchase Order and notify GSK Automotive promptly of any backorders, pricing discrepancies, or changes to the expected delivery schedule.',
                    marginLeft,
                    currentY,
                    { width: contentWidth }
                );
            currentY += 28;
            doc.fillColor('#111827').font('Helvetica-Bold').fontSize(9)
                .text('GSK Automotive', marginLeft, currentY);
            currentY += 12;
            doc.fillColor('#4b5563').font('Helvetica').fontSize(8.5)
                .text('Purchasing / Procurement Team', marginLeft, currentY);

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
};

export default generatePurchaseOrderPDF;

