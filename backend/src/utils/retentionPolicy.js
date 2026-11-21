import { DateTime } from 'luxon';
import Invoice from '../models/Invoice.js';
import Quote from '../models/Quote.js';
import JobCard from '../models/JobCard.js';
import AuditLog from '../models/AuditLog.js';

export const SYDNEY_ZONE = 'Australia/Sydney';

export const RETENTION_POLICY = {
    INVOICE_MIN_RETENTION_YEARS: 5,
    INVOICE_ARCHIVE_AFTER_YEARS: 2,
    DRAFT_REVIEW_INACTIVITY_DAYS: 90,
    QUOTE_REVIEW_AFTER_MONTHS: 12,
    BACKUP_MIN_RETENTION_DAYS: 30,
    BACKUP_MAX_RETENTION_DAYS: 90,
    OFFICIAL_SCHEDULE: [
        {
            dataType: 'Issued Invoices',
            retentionPolicy: 'Retain for at least 5 years',
            details: 'Minimum 5-year statutory/accounting retention. Never auto-deleted.'
        },
        {
            dataType: 'Paid Invoices',
            retentionPolicy: 'Retain for at least 5 years',
            details: 'Minimum 5-year statutory/accounting retention. Never auto-deleted.'
        },
        {
            dataType: 'Cancelled or Voided Invoices',
            retentionPolicy: 'Retain audit records for at least 5 years',
            details: 'Preserves original invoice number, customer snapshot, amount, cancellation reason, actor, and timestamp.'
        },
        {
            dataType: 'Customer Information on Invoices',
            retentionPolicy: 'Retain as needed for legal and accounting records',
            details: 'Immutable customer snapshot captured at invoice issuance so profile edits do not alter historical invoices.'
        },
        {
            dataType: 'Draft Invoices',
            retentionPolicy: 'Review after 90 days of inactivity',
            details: 'Flagged for admin review after 90 days of inactivity. Protected if linked to active Job Cards. Never auto-deleted.'
        },
        {
            dataType: 'Quotes and Estimates',
            retentionPolicy: 'Review after 12 months',
            details: 'Flagged for admin review after 12 months. Protected if converted to an invoice or under active discussion.'
        },
        {
            dataType: 'Database Backups',
            retentionPolicy: 'Daily backups with 30–90 days of recovery history',
            details: 'Daily logical snapshots with SHA-256 verification, Cloudinary asset manifest, and 30–90 day retention pruning.'
        },
        {
            dataType: 'Invoices Older Than 2 Years',
            retentionPolicy: 'Move to searchable, read-only archive',
            details: 'Automatically or manually transitioned to read-only archive status after 2 years while remaining searchable and downloadable.'
        }
    ]
};

export const FINANCIAL_RETENTION_STATUSES = ['Unpaid', 'Partially Paid', 'Paid', 'Cancelled', 'Voided'];
export const ARCHIVABLE_INVOICE_STATUSES = ['Unpaid', 'Partially Paid', 'Paid'];

/**
 * Determine the authoritative transaction/record date of an invoice for 2-year archival and 5-year retention.
 */
export function getEffectiveInvoiceDate(invoice) {
    if (!invoice) return new Date();
    const raw = invoice.invoiceDate || invoice.issuedAt || invoice.paidAt || invoice.createdAt || new Date();
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Determine the last meaningful activity timestamp for a draft invoice.
 */
export function getEffectiveDraftActivityDate(invoice) {
    if (!invoice) return new Date();
    const raw = invoice.lastMeaningfulActivityAt || invoice.updatedAt || invoice.createdAt || new Date();
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Build an immutable customer snapshot from a Customer document or plain object.
 */
export function buildCustomerSnapshot(customer, capturedAt = new Date()) {
    if (!customer) return null;
    return {
        name: customer.name || customer.fullName || '',
        email: customer.email || '',
        phone: customer.phone || '',
        address: customer.address || '',
        customerType: customer.customerType || 'individual',
        idType: customer.idType || '',
        idNumber: customer.idNumber || '',
        capturedAt
    };
}

/**
 * Build an immutable vehicle snapshot from a Vehicle or VehicleBatchMembership document.
 */
export function buildVehicleSnapshot(vehicle) {
    if (!vehicle) return null;
    return {
        registrationNumber: vehicle.registrationNumber || vehicle.regNo || '',
        brand: vehicle.brand || vehicle.make || '',
        make: vehicle.make || vehicle.brand || '',
        model: vehicle.model || '',
        year: vehicle.year ? String(vehicle.year) : '',
        vin: vehicle.vin || ''
    };
}

/**
 * Compute comprehensive retention & archival metadata for an invoice.
 */
export function computeInvoiceRetentionInfo(invoice, options = {}) {
    const nowJS = options.now ? new Date(options.now) : new Date();
    const nowSydney = DateTime.fromJSDate(nowJS, { zone: SYDNEY_ZONE });

    const effectiveDateJS = getEffectiveInvoiceDate(invoice);
    const effectiveSydney = DateTime.fromJSDate(effectiveDateJS, { zone: SYDNEY_ZONE });

    const archiveEligibleSydney = effectiveSydney.plus({ years: RETENTION_POLICY.INVOICE_ARCHIVE_AFTER_YEARS });
    const retainUntilSydney = invoice?.retentionMetadata?.retainUntil
        ? DateTime.fromJSDate(new Date(invoice.retentionMetadata.retainUntil), { zone: SYDNEY_ZONE })
        : effectiveSydney.plus({ years: RETENTION_POLICY.INVOICE_MIN_RETENTION_YEARS });

    const ageDays = Math.max(0, Math.floor(nowSydney.diff(effectiveSydney, 'days').days));
    const ageYears = Number((nowSydney.diff(effectiveSydney, 'years').years).toFixed(2));

    const status = invoice?.status || 'Unpaid';
    const isDraft = status === 'Draft';
    const isCancelledOrVoided = status === 'Cancelled' || status === 'Voided';
    const isFinancialRecord = FINANCIAL_RETENTION_STATUSES.includes(status);

    // 2-year read-only archive eligibility (only non-draft issued/paid records)
    const isPastTwoYears = nowSydney >= archiveEligibleSydney;
    const isArchiveEligible = !isDraft && ARCHIVABLE_INVOICE_STATUSES.includes(status) && isPastTwoYears;
    const isArchived = Boolean(invoice?.isArchived || invoice?.archiveStatus === 'archived');

    // 5-year minimum retention eligibility
    const isPastFiveYears = nowSydney >= retainUntilSydney;

    // Check active Job Card linkage
    const jobCardStatus = invoice?.jobCardId?.status || options.jobCardStatus || null;
    const hasActiveJobCard = Boolean(
        invoice?.jobCardId &&
        jobCardStatus &&
        !['Completed', 'Cancelled', 'Closed'].includes(jobCardStatus)
    );

    // Check blocking obligations preventing disposal even after 5 years
    const blockingReasons = [];
    if (isFinancialRecord && !isPastFiveYears) {
        blockingReasons.push(`Within mandatory ${RETENTION_POLICY.INVOICE_MIN_RETENTION_YEARS}-year minimum retention period (until ${retainUntilSydney.toFormat('dd LLL yyyy')}).`);
    }
    if (status === 'Unpaid' || status === 'Partially Paid') {
        const balance = Math.max(0, Number(invoice?.totalAmount || 0) - Number(invoice?.amountPaid || 0));
        if (balance > 0) {
            blockingReasons.push(`Unsettled financial balance ($${balance.toFixed(2)} outstanding).`);
        } else {
            blockingReasons.push(`Invoice status is ${status} (unsettled payment obligation).`);
        }
    }
    if (invoice?.retentionMetadata?.legalHold) {
        blockingReasons.push(
            invoice.retentionMetadata.legalHoldReason
                ? `Active Legal/Audit Hold: ${invoice.retentionMetadata.legalHoldReason}`
                : 'Active Legal/Audit Hold.'
        );
    }
    if (hasActiveJobCard) {
        blockingReasons.push(`Linked to active Job Card (${jobCardStatus}).`);
    }

    // 90-day Draft inactivity calculation
    const draftActivityJS = getEffectiveDraftActivityDate(invoice);
    const draftActivitySydney = DateTime.fromJSDate(draftActivityJS, { zone: SYDNEY_ZONE });
    const draftInactiveDays = Math.max(0, Math.floor(nowSydney.diff(draftActivitySydney, 'days').days));
    const draftReviewStatus = invoice?.retentionMetadata?.draftReviewStatus || 'active';
    const isDraftReviewEligible =
        isDraft &&
        draftInactiveDays >= RETENTION_POLICY.DRAFT_REVIEW_INACTIVITY_DAYS &&
        !hasActiveJobCard &&
        draftReviewStatus !== 'retained';

    // 5-year review status
    let reviewStatus = invoice?.retentionMetadata?.reviewStatus || 'not_due';
    if (isFinancialRecord && isPastFiveYears && reviewStatus === 'not_due') {
        reviewStatus = 'pending_review';
    }

    const isFiveYearReviewEligible = isFinancialRecord && isPastFiveYears;

    // Can soft-delete via ordinary admin delete?
    // Issued, Paid, Cancelled, and Voided invoices CANNOT be deleted via ordinary admin delete.
    // Only Draft invoices (not linked to an active Job Card) can be soft-deleted.
    const canSoftDelete = isDraft && !hasActiveJobCard;

    // Can permanently delete from database/trash?
    // Drafts (without active Job Card) OR financial records >= 5 years old with zero blocking obligations AND explicit disposal approval.
    const canDeletePermanently = isDraft
        ? !hasActiveJobCard
        : (isPastFiveYears && blockingReasons.length === 0 && reviewStatus === 'approved_for_disposal');

    return {
        createdAt: invoice?.createdAt || effectiveDateJS,
        invoiceDate: effectiveDateJS,
        lastModifiedAt: invoice?.lastMeaningfulActivityAt || invoice?.updatedAt || invoice?.createdAt || effectiveDateJS,
        archiveEligibleAt: archiveEligibleSydney.toJSDate(),
        retentionEligibleAt: retainUntilSydney.toJSDate(),
        retainUntil: retainUntilSydney.toJSDate(),
        archiveStatus: isArchived ? 'archived' : 'active',
        isArchived,
        isReadOnly: isArchived || isCancelledOrVoided,
        isArchiveEligible,
        retentionPeriod: isDraft ? '90 days inactivity review' : 'Minimum 5 years',
        reviewStatus: isDraft ? (isDraftReviewEligible ? 'pending_review' : draftReviewStatus) : reviewStatus,
        isFiveYearReviewEligible,
        isPastFiveYears,
        isDraft,
        isDraftReviewEligible,
        draftInactiveDays,
        hasActiveJobCard,
        hasBlockingObligations: blockingReasons.length > 0,
        blockingReasons,
        canSoftDelete,
        canDeletePermanently,
        ageDays,
        ageYears
    };
}

/**
 * Compute 12-month review eligibility for Quotes & Estimates.
 */
export function computeQuoteRetentionInfo(quote, options = {}) {
    const nowJS = options.now ? new Date(options.now) : new Date();
    const nowSydney = DateTime.fromJSDate(nowJS, { zone: SYDNEY_ZONE });

    const createdJS = quote?.createdAt ? new Date(quote.createdAt) : nowJS;
    const createdSydney = DateTime.fromJSDate(createdJS, { zone: SYDNEY_ZONE });
    const reviewEligibleSydney = createdSydney.plus({ months: RETENTION_POLICY.QUOTE_REVIEW_AFTER_MONTHS });

    const ageMonths = Math.max(0, Math.floor(nowSydney.diff(createdSydney, 'months').months));
    const ageDays = Math.max(0, Math.floor(nowSydney.diff(createdSydney, 'days').days));
    const isPastTwelveMonths = nowSydney >= reviewEligibleSydney;

    const isConvertedToInvoice = Boolean(quote?.convertedToInvoiceId);
    const hasOngoingDiscussion = ['In Review'].includes(quote?.status);
    const isArchived = Boolean(quote?.isArchived || quote?.retentionReview?.reviewStatus === 'archived');
    const reviewStatus = quote?.retentionReview?.reviewStatus || (isPastTwelveMonths ? 'pending_review' : 'not_due');

    const protectionReasons = [];
    if (isConvertedToInvoice) {
        protectionReasons.push('Converted into an Invoice (must be preserved with invoice history).');
    }
    if (hasOngoingDiscussion) {
        protectionReasons.push('Quote is currently In Review / active customer discussion.');
    }

    const isReviewEligible =
        isPastTwelveMonths &&
        !isArchived &&
        !isConvertedToInvoice &&
        !hasOngoingDiscussion &&
        reviewStatus !== 'retained';

    return {
        createdAt: createdJS,
        lastModifiedAt: quote?.updatedAt || createdJS,
        retentionEligibleAt: reviewEligibleSydney.toJSDate(),
        retentionPeriod: 'Review after 12 months',
        archiveStatus: isArchived ? 'archived' : 'active',
        isArchived,
        isPastTwelveMonths,
        isReviewEligible,
        reviewStatus: isReviewEligible ? 'pending_review' : reviewStatus,
        isProtected: protectionReasons.length > 0,
        protectionReasons,
        ageMonths,
        ageDays
    };
}

/**
 * Run bounded, idempotent batch archival for Issued and Paid invoices older than 2 years.
 * Safe for Vercel Hobby serverless execution limits and MongoDB Atlas free tier.
 */
export async function runBatchInvoiceArchival({
    now = new Date(),
    batchSize = 100,
    actorId = null,
    archiveReason = 'Automated 2-year retention policy archival (read-only archive)'
} = {}) {
    const nowSydney = DateTime.fromJSDate(new Date(now), { zone: SYDNEY_ZONE });
    const cutoffDate = nowSydney.minus({ years: RETENTION_POLICY.INVOICE_ARCHIVE_AFTER_YEARS }).toJSDate();

    // Find unarchived issued/paid invoices whose effective date is <= cutoffDate.
    // Because legacy records might have invoiceDate or createdAt, check both safely.
    const candidates = await Invoice.find({
        isActive: true,
        isArchived: { $ne: true },
        status: { $in: ARCHIVABLE_INVOICE_STATUSES },
        $or: [
            { invoiceDate: { $lte: cutoffDate } },
            { invoiceDate: { $exists: false }, createdAt: { $lte: cutoffDate } }
        ]
    })
        .select('_id invoiceNo status invoiceDate paidAt createdAt isArchived')
        .sort({ invoiceDate: 1, createdAt: 1 })
        .limit(Math.min(Math.max(Number(batchSize) || 100, 1), 500))
        .lean();

    const eligibleIds = [];
    const eligibleInvoiceNos = [];

    for (const inv of candidates) {
        const effectiveDate = getEffectiveInvoiceDate(inv);
        if (effectiveDate <= cutoffDate) {
            eligibleIds.push(inv._id);
            eligibleInvoiceNos.push(inv.invoiceNo);
        }
    }

    if (eligibleIds.length === 0) {
        return {
            archivedCount: 0,
            archivedInvoiceNos: [],
            cutoffDate,
            idempotent: true
        };
    }

    const archivedAt = new Date(now);
    const updateResult = await Invoice.updateMany(
        {
            _id: { $in: eligibleIds },
            isArchived: { $ne: true }
        },
        {
            $set: {
                isArchived: true,
                archiveStatus: 'archived',
                archivedAt,
                archivedBy: actorId || null,
                archiveReason
            }
        }
    );

    if (actorId && updateResult.modifiedCount > 0) {
        await AuditLog.create({
            actor: actorId,
            action: 'BATCH_ARCHIVE_INVOICES',
            target: `Archived ${updateResult.modifiedCount} invoices (>2 years old)`,
            metadata: {
                archivedCount: updateResult.modifiedCount,
                archivedInvoiceNos: eligibleInvoiceNos,
                cutoffDate: cutoffDate.toISOString(),
                archiveReason
            }
        });
    }

    return {
        archivedCount: updateResult.modifiedCount || 0,
        archivedInvoiceNos: eligibleInvoiceNos,
        cutoffDate,
        idempotent: true
    };
}

