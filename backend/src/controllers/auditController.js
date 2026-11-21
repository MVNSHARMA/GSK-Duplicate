import mongoose from 'mongoose';
import AuditLog from '../models/AuditLog.js';
import User from '../models/User.js';
import { auditEventLabel } from '../utils/auditEvents.js';
import { escapeRegex } from '../utils/sanitize.js';

const SENSITIVE_KEYS = /password|token|secret|apiKey|authorization|headers|cookie/i;

export const sanitizeMetadata = (value) => {
  if (Array.isArray(value)) return value.map(sanitizeMetadata);
  if (!value || typeof value !== 'object') return value;

  return Object.entries(value).reduce((result, [key, entry]) => {
    if (!SENSITIVE_KEYS.test(key)) result[key] = sanitizeMetadata(entry);
    return result;
  }, {});
};

const buildSearchFilter = async (search) => {
  if (!search) return {};
  const safeSearch = escapeRegex(search.trim());

  const actors = await User.find({
    $or: [
      { name: { $regex: safeSearch, $options: 'i' } },
      { email: { $regex: safeSearch, $options: 'i' } }
    ]
  }).select('_id').limit(100);

  const actorIds = actors.map(({ _id }) => _id);
  return {
    $or: [
      { action: { $regex: safeSearch, $options: 'i' } },
      { description: { $regex: safeSearch, $options: 'i' } },
      { target: { $regex: safeSearch, $options: 'i' } },
      { entityDisplay: { $regex: safeSearch, $options: 'i' } },
      { actorName: { $regex: safeSearch, $options: 'i' } },
      { actorEmail: { $regex: safeSearch, $options: 'i' } },
      ...(actorIds.length ? [{ actor: { $in: actorIds } }] : [])
    ]
  };
};

import { DateTime } from 'luxon';

const parseDateFilter = (datePreset, customFromDate, customToDate) => {
  if (!datePreset || datePreset === 'all') return {};

  const nowSydney = DateTime.now().setZone('Australia/Sydney');
  let start, end;
  
  if (datePreset === 'today') {
      start = nowSydney.startOf('day').toJSDate();
      end = nowSydney.endOf('day').toJSDate();
  } else if (datePreset === 'last_7_days') {
      start = nowSydney.minus({ days: 7 }).startOf('day').toJSDate();
      end = nowSydney.endOf('day').toJSDate();
  } else if (datePreset === 'last_30_days') {
      start = nowSydney.minus({ days: 30 }).startOf('day').toJSDate();
      end = nowSydney.endOf('day').toJSDate();
  } else if (datePreset === 'custom' && customFromDate && customToDate) {
      start = DateTime.fromISO(customFromDate, { zone: 'Australia/Sydney' }).startOf('day').toJSDate();
      end = DateTime.fromISO(customToDate, { zone: 'Australia/Sydney' }).endOf('day').toJSDate();
  }

  if (start && end) {
      return { $gte: start, $lte: end };
  }
  return {};
};

const serializeLog = (log) => ({
  ...log,
  actorName: log.actorName || log.actor?.name,
  actorEmail: log.actorEmail || log.actor?.email,
  actorRole: log.actorRole || log.actor?.role,
  actionLabel: auditEventLabel(log.action),
  metadata: sanitizeMetadata(log.metadata)
});

export const getAuditLogs = async (req, res) => {
  try {
    const {
      search,
      actor,
      role,
      action,
      entityType,
      entityId,
      targetEmployee,
      datePreset,
      customFromDate,
      customToDate,
      page = 1,
      limit = 25
    } = req.query;

    const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 25));
    const filter = {};
    const searchFilter = await buildSearchFilter(search);

    if (searchFilter.$or) filter.$or = searchFilter.$or;
    if (actor && mongoose.isValidObjectId(actor)) filter.actor = actor;
    if (role) filter.actorRole = role;
    if (action) filter.action = action;
    if (entityType) filter.entityType = entityType;
    if (entityId) filter.entityId = entityId;
    if (targetEmployee && mongoose.isValidObjectId(targetEmployee)) filter.targetUser = targetEmployee;

    const dateFilter = parseDateFilter(datePreset, customFromDate, customToDate);
    if (Object.keys(dateFilter).length) filter.createdAt = dateFilter;

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .select('-__v')
        .populate('actor', 'name email role')
        .sort({ createdAt: -1 })
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit)
        .lean(),
      AuditLog.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      data: logs.map(serializeLog),
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        pages: Math.ceil(total / safeLimit),
        hasNext: safePage * safeLimit < total,
        hasPrevious: safePage > 1
      }
    });
  } catch (error) {
    console.error('Audit log retrieval error:', error);
    res.status(500).json({ success: false, error: 'Unable to load audit logs' });
  }
};

export const getAuditLogById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, error: 'Audit event not found' });
    }

    const log = await AuditLog.findById(req.params.id).select('-__v').populate('actor', 'name email role').lean();
    if (!log) return res.status(404).json({ success: false, error: 'Audit event not found' });

    res.status(200).json({ success: true, data: serializeLog(log) });
  } catch (error) {
    console.error('Audit log detail error:', error);
    res.status(500).json({ success: false, error: 'Unable to load audit event' });
  }
};