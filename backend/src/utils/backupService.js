import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { DateTime } from 'luxon';
import { RETENTION_POLICY, SYDNEY_ZONE } from './retentionPolicy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_BACKUP_DIR = path.resolve(__dirname, '../../backups');
const FALLBACK_TMP_DIR = path.join(os.tmpdir(), 'gsk-automotive-backups');

/**
 * Resolve writable backup directory (uses backend/backups locally, falls back to /tmp on Vercel serverless).
 */
export function resolveWritableBackupDir(customDir = null) {
    if (customDir) {
        fs.mkdirSync(customDir, { recursive: true });
        return customDir;
    }
    try {
        fs.mkdirSync(DEFAULT_BACKUP_DIR, { recursive: true });
        fs.accessSync(DEFAULT_BACKUP_DIR, fs.constants.W_OK);
        return DEFAULT_BACKUP_DIR;
    } catch {
        fs.mkdirSync(FALLBACK_TMP_DIR, { recursive: true });
        return FALLBACK_TMP_DIR;
    }
}

/**
 * Return all readable backup directories (both repo backups/ and /tmp fallback if different).
 */
export function getReadableBackupDirs(customDir = null) {
    if (customDir) return [customDir];
    const dirs = new Set();
    if (fs.existsSync(DEFAULT_BACKUP_DIR)) dirs.add(DEFAULT_BACKUP_DIR);
    if (fs.existsSync(FALLBACK_TMP_DIR)) dirs.add(FALLBACK_TMP_DIR);
    return Array.from(dirs);
}

function sha256(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Create a full logical database backup with SHA-256 checksums, invoice archival metadata,
 * and external Cloudinary/PDF asset recovery manifest.
 */
export async function createDatabaseBackup({
    backupDir = null,
    retentionDays = RETENTION_POLICY.BACKUP_MAX_RETENTION_DAYS,
    triggeredBy = 'system',
    note = 'Scheduled daily backup'
} = {}) {
    const db = mongoose.connection?.db;
    if (!db) {
        throw new Error('Database connection is not ready for backup.');
    }

    const effectiveRetentionDays = Math.min(
        Math.max(Number(retentionDays) || RETENTION_POLICY.BACKUP_MAX_RETENTION_DAYS, RETENTION_POLICY.BACKUP_MIN_RETENTION_DAYS),
        RETENTION_POLICY.BACKUP_MAX_RETENTION_DAYS
    );

    const now = new Date();
    const timestamp = now.getTime();
    const backupId = `backup_${timestamp}`;
    const targetRoot = resolveWritableBackupDir(backupDir);
    const snapshotDir = path.join(targetRoot, backupId);
    fs.mkdirSync(snapshotDir, { recursive: true });

    const collections = await db.listCollections().toArray();
    const collectionStats = {};
    let totalDocuments = 0;
    let totalBytes = 0;

    const cloudinaryAssetManifest = [];
    let invoiceSummary = {
        total: 0,
        active: 0,
        archived: 0,
        paid: 0,
        unpaidOrPartial: 0,
        cancelledOrVoided: 0,
        draft: 0
    };

    for (const col of collections) {
        const colName = col.name;
        if (colName.startsWith('system.')) continue;

        const docs = await db.collection(colName).find({}).toArray();
        const serialized = JSON.stringify(docs, null, 2);
        const filePath = path.join(snapshotDir, `${colName}.json`);
        fs.writeFileSync(filePath, serialized, 'utf8');

        const bytes = Buffer.byteLength(serialized, 'utf8');
        const checksum = sha256(serialized);
        totalDocuments += docs.length;
        totalBytes += bytes;

        collectionStats[colName] = {
            file: `${colName}.json`,
            count: docs.length,
            bytes,
            sha256: checksum
        };

        if (colName === 'invoices') {
            for (const inv of docs) {
                if (inv.isActive === false) continue;
                invoiceSummary.total += 1;
                if (inv.isArchived) invoiceSummary.archived += 1;
                else invoiceSummary.active += 1;
                if (inv.status === 'Paid') invoiceSummary.paid += 1;
                else if (inv.status === 'Unpaid' || inv.status === 'Partially Paid') invoiceSummary.unpaidOrPartial += 1;
                else if (inv.status === 'Cancelled' || inv.status === 'Voided') invoiceSummary.cancelledOrVoided += 1;
                else if (inv.status === 'Draft') invoiceSummary.draft += 1;
            }
        }

        // Collect external uploaded document URLs for disaster recovery manifest
        if (['vehicledocuments', 'trackercardocuments'].includes(colName)) {
            for (const doc of docs) {
                if (doc.fileUrl || doc.url) {
                    cloudinaryAssetManifest.push({
                        collection: colName,
                        recordId: String(doc._id),
                        url: doc.fileUrl || doc.url,
                        publicId: doc.publicId || doc.cloudinaryPublicId || null,
                        fileName: doc.fileName || doc.title || ''
                    });
                }
            }
        } else if (['bookings', 'quotes'].includes(colName)) {
            for (const doc of docs) {
                if (Array.isArray(doc.images)) {
                    for (const img of doc.images) {
                        if (img?.url) {
                            cloudinaryAssetManifest.push({
                                collection: colName,
                                recordId: String(doc._id),
                                url: img.url,
                                publicId: img.publicId || null
                            });
                        }
                    }
                }
            }
        }
    }

    const expiresAt = DateTime.fromJSDate(now, { zone: SYDNEY_ZONE })
        .plus({ days: effectiveRetentionDays })
        .toJSDate();

    const manifest = {
        backupId,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        retentionWindowDays: {
            min: RETENTION_POLICY.BACKUP_MIN_RETENTION_DAYS,
            max: RETENTION_POLICY.BACKUP_MAX_RETENTION_DAYS,
            configured: effectiveRetentionDays
        },
        triggeredBy,
        note,
        databaseName: db.databaseName || 'gsk_automotive',
        totalCollections: Object.keys(collectionStats).length,
        totalDocuments,
        totalBytes,
        invoiceSummary,
        documentRecoveryStrategy: {
            invoiceAndPurchaseOrderPDFs: 'Deterministic on-demand PDF generation from backed-up Invoice, CustomerSnapshot, and PurchaseOrder documents via PDFKit.',
            uploadedCloudFilesCount: cloudinaryAssetManifest.length,
            cloudinaryAssets: cloudinaryAssetManifest
        },
        collections: collectionStats
    };

    fs.writeFileSync(path.join(snapshotDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

    // Enforce 30-90 day backup retention policy (prune snapshots older than max retention)
    const pruneResult = pruneExpiredBackups({
        backupDir: targetRoot,
        maxRetentionDays: effectiveRetentionDays,
        now
    });

    return {
        ...manifest,
        snapshotDir,
        prunedBackups: pruneResult.prunedBackupIds
    };
}

/**
 * List all available backups across readable backup directories.
 */
export function listDatabaseBackups({ backupDir = null, now = new Date() } = {}) {
    const dirs = getReadableBackupDirs(backupDir);
    const backups = [];
    const nowSydney = DateTime.fromJSDate(new Date(now), { zone: SYDNEY_ZONE });

    for (const rootDir of dirs) {
        if (!fs.existsSync(rootDir)) continue;
        const entries = fs.readdirSync(rootDir, { withFileTypes: true });

        for (const entry of entries) {
            if (!entry.isDirectory() || !entry.name.startsWith('backup_')) continue;
            const fullPath = path.join(rootDir, entry.name);
            const manifestPath = path.join(fullPath, 'manifest.json');

            let createdAt = null;
            const tsMatch = entry.name.match(/^backup_(\d+)$/);
            if (tsMatch) {
                const parsedTs = Number(tsMatch[1]);
                if (!Number.isNaN(parsedTs)) createdAt = new Date(parsedTs);
            }

            if (fs.existsSync(manifestPath)) {
                try {
                    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                    const createdJS = new Date(manifest.createdAt || createdAt || fs.statSync(fullPath).mtime);
                    const ageDays = Math.max(0, Math.floor(nowSydney.diff(DateTime.fromJSDate(createdJS, { zone: SYDNEY_ZONE }), 'days').days));
                    backups.push({
                        backupId: manifest.backupId || entry.name,
                        createdAt: createdJS.toISOString(),
                        expiresAt: manifest.expiresAt || DateTime.fromJSDate(createdJS, { zone: SYDNEY_ZONE }).plus({ days: 90 }).toJSDate().toISOString(),
                        ageDays,
                        totalCollections: manifest.totalCollections || Object.keys(manifest.collections || {}).length,
                        totalDocuments: manifest.totalDocuments || 0,
                        totalBytes: manifest.totalBytes || 0,
                        invoiceSummary: manifest.invoiceSummary || null,
                        triggeredBy: manifest.triggeredBy || 'system',
                        note: manifest.note || '',
                        hasManifest: true,
                        path: fullPath
                    });
                    continue;
                } catch {
                    // Fallback to directory inspection below
                }
            }

            // Legacy backup directory without manifest.json
            const files = fs.readdirSync(fullPath).filter(f => f.endsWith('.json'));
            let totalBytes = 0;
            let totalDocuments = 0;
            for (const f of files) {
                const fp = path.join(fullPath, f);
                const stat = fs.statSync(fp);
                totalBytes += stat.size;
                try {
                    const arr = JSON.parse(fs.readFileSync(fp, 'utf8'));
                    if (Array.isArray(arr)) totalDocuments += arr.length;
                } catch {
                    // ignore malformed file
                }
            }
            const stat = fs.statSync(fullPath);
            const fallbackCreated = createdAt || stat.mtime;
            const ageDays = Math.max(0, Math.floor(nowSydney.diff(DateTime.fromJSDate(fallbackCreated, { zone: SYDNEY_ZONE }), 'days').days));

            backups.push({
                backupId: entry.name,
                createdAt: fallbackCreated.toISOString(),
                expiresAt: DateTime.fromJSDate(fallbackCreated, { zone: SYDNEY_ZONE }).plus({ days: 90 }).toJSDate().toISOString(),
                ageDays,
                totalCollections: files.length,
                totalDocuments,
                totalBytes,
                invoiceSummary: null,
                triggeredBy: 'legacy_snapshot',
                note: 'Pre-existing collection JSON snapshot',
                hasManifest: false,
                path: fullPath
            });
        }
    }

    backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return backups;
}

/**
 * Prune backups older than maxRetentionDays (default 90 days) while always preserving backups within minRetentionDays (30 days).
 */
export function pruneExpiredBackups({
    backupDir = null,
    maxRetentionDays = RETENTION_POLICY.BACKUP_MAX_RETENTION_DAYS,
    now = new Date()
} = {}) {
    const targetRoot = resolveWritableBackupDir(backupDir);
    const effectiveMaxDays = Math.max(
        Number(maxRetentionDays) || RETENTION_POLICY.BACKUP_MAX_RETENTION_DAYS,
        RETENTION_POLICY.BACKUP_MIN_RETENTION_DAYS
    );
    const cutoff = DateTime.fromJSDate(new Date(now), { zone: SYDNEY_ZONE })
        .minus({ days: effectiveMaxDays })
        .toJSDate();

    const prunedBackupIds = [];
    if (!fs.existsSync(targetRoot)) {
        return { prunedBackupIds, cutoffDate: cutoff };
    }

    const entries = fs.readdirSync(targetRoot, { withFileTypes: true });
    for (const entry of entries) {
        if (!entry.isDirectory() || !entry.name.startsWith('backup_')) continue;
        const fullPath = path.join(targetRoot, entry.name);
        const manifestPath = path.join(fullPath, 'manifest.json');

        let createdDate = null;
        if (fs.existsSync(manifestPath)) {
            try {
                const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                if (manifest.createdAt) createdDate = new Date(manifest.createdAt);
            } catch {
                // ignore
            }
        }
        if (!createdDate) {
            const match = entry.name.match(/^backup_(\d+)$/);
            if (match) createdDate = new Date(Number(match[1]));
            else createdDate = fs.statSync(fullPath).mtime;
        }

        if (createdDate && createdDate < cutoff) {
            fs.rmSync(fullPath, { recursive: true, force: true });
            prunedBackupIds.push(entry.name);
        }
    }

    return { prunedBackupIds, cutoffDate: cutoff };
}

/**
 * Verify backup integrity and perform a non-destructive restoration verification check.
 * Optionally restores into a provided targetDb (e.g., an isolated mongodb-memory-server test DB)
 * when `restoreToDb` is supplied.
 */
export async function verifyBackupRestoration({
    backupId = null,
    backupDir = null,
    restoreToDb = null
} = {}) {
    const backups = listDatabaseBackups({ backupDir });
    if (backups.length === 0) {
        throw new Error('No database backups found to verify.');
    }

    const target = backupId
        ? backups.find(b => b.backupId === backupId)
        : backups[0];

    if (!target) {
        throw new Error(`Backup ${backupId} not found.`);
    }

    const snapshotDir = target.path;
    const manifestPath = path.join(snapshotDir, 'manifest.json');
    let manifest = null;
    if (fs.existsSync(manifestPath)) {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    }

    const jsonFiles = fs.readdirSync(snapshotDir).filter(f => f.endsWith('.json') && f !== 'manifest.json');
    const verifiedCollections = {};
    const checksumFailures = [];
    let restoredInvoices = [];

    for (const file of jsonFiles) {
        const colName = file.replace(/\.json$/, '');
        const raw = fs.readFileSync(path.join(snapshotDir, file), 'utf8');
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            throw new Error(`Invalid backup format in ${file}: expected JSON array.`);
        }

        const actualChecksum = sha256(raw);
        const expectedChecksum = manifest?.collections?.[colName]?.sha256 || null;
        if (expectedChecksum && actualChecksum !== expectedChecksum) {
            checksumFailures.push({
                collection: colName,
                expected: expectedChecksum,
                actual: actualChecksum
            });
        }

        verifiedCollections[colName] = {
            documentCount: parsed.length,
            checksumVerified: expectedChecksum ? actualChecksum === expectedChecksum : true,
            sha256: actualChecksum
        };

        if (colName === 'invoices') {
            restoredInvoices = parsed;
        }

        // If an isolated test database is passed (for controlled restoration test), restore documents into it
        if (restoreToDb) {
            const targetCol = restoreToDb.collection(`restored_${colName}`);
            await targetCol.deleteMany({});
            if (parsed.length > 0) {
                await targetCol.insertMany(parsed);
            }
        }
    }

    const activeInvoices = restoredInvoices.filter(i => i.isActive !== false && !i.isArchived);
    const archivedInvoices = restoredInvoices.filter(i => i.isActive !== false && i.isArchived);
    const cancelledVoidedInvoices = restoredInvoices.filter(i => ['Cancelled', 'Voided'].includes(i.status));

    return {
        verified: checksumFailures.length === 0,
        backupId: target.backupId,
        createdAt: target.createdAt,
        collectionsVerified: Object.keys(verifiedCollections).length,
        checksumFailures,
        invoiceVerification: {
            totalInvoicesInBackup: restoredInvoices.length,
            activeCount: activeInvoices.length,
            archivedCount: archivedInvoices.length,
            cancelledOrVoidedCount: cancelledVoidedInvoices.length,
            customerSnapshotsIntact: restoredInvoices.every(
                i => !i.customerSnapshot || typeof i.customerSnapshot === 'object'
            )
        },
        collections: verifiedCollections
    };
}
