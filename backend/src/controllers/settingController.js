import Setting from '../models/Setting.js';
import AuditLog from '../models/AuditLog.js';
import User from '../models/User.js';
import Invitation from '../models/Invitation.js';
import getCloudinary from '../config/cloudinary.js';
import {
    PAGE_KEYS,
    isValidPageKey,
    isGrantablePage,
    normalizePageKey,
    isValidActionKey
} from '../middleware/permissions.js';
import { invalidateUserCache } from '../middleware/auth.js';

const SETTINGS_CACHE_TTL_MS = 60 * 1000;
let settingsCache = { data: null, expiresAt: 0 };

export const invalidateSettingsCache = () => {
    settingsCache = { data: null, expiresAt: 0 };
};

// @desc    Get global business settings
// @route   GET /api/settings
// @access  Private
export const getSettings = async (req, res) => {
    try {
        const now = Date.now();
        if (settingsCache.data && settingsCache.expiresAt > now) {
            return res.status(200).json({
                success: true,
                data: settingsCache.data
            });
        }

        let settings = await Setting.findOne();
        if (!settings) {
            // Create default settings if they don't exist
            settings = await Setting.create({});
        } else if (settings.defaultEmployeePermissions && !settings.defaultEmployeePermissions.admin && settings.defaultEmployeePermissions.pagePermissions) {
            // Migrate old single configuration to independent Admin and Mechanic configs
            const oldConfig = {
                pagePermissions: settings.defaultEmployeePermissions.pagePermissions,
                additionalPageAccess: settings.defaultEmployeePermissions.additionalPageAccess || [],
                additionalActionPermissions: settings.defaultEmployeePermissions.additionalActionPermissions || []
            };
            settings.defaultEmployeePermissions = {
                admin: oldConfig,
                mechanic: oldConfig
            };
            await settings.save();
        }
        settingsCache = { data: settings, expiresAt: now + SETTINGS_CACHE_TTL_MS };
        res.status(200).json({
            success: true,
            data: settings
        });
    } catch (error) {
        console.error("Error fetching settings:", error);
        res.status(500).json({ success: false, error: "Server Error fetching settings" });
    }
};

/**
 * Synchronize all existing employees and pending invitations of a role with the updated role defaults.
 * Propagates changes persistently into the database for live authorization and route enforcement.
 */
export const syncEmployeesWithRoleDefaults = async (roleKey, roleDefaults) => {
    // Only configurable employee roles are synchronized. Super admin permissions are immutable.
    if (!['admin', 'mechanic'].includes(roleKey)) {
        return { modifiedUsersCount: 0, modifiedInvitesCount: 0 };
    }

    if (!roleDefaults || !roleDefaults.pagePermissions) {
        return { modifiedUsersCount: 0, modifiedInvitesCount: 0 };
    }

    // Extract raw page permissions
    const rawPerms = roleDefaults.pagePermissions;
    const normalizedEntries = [];
    if (typeof rawPerms.entries === 'function') {
        for (const [k, v] of rawPerms.entries()) {
            normalizedEntries.push([normalizePageKey(k), Boolean(v)]);
        }
    } else if (typeof rawPerms === 'object' && rawPerms !== null) {
        for (const [k, v] of Object.entries(rawPerms)) {
            normalizedEntries.push([normalizePageKey(k), Boolean(v)]);
        }
    }

    // Determine normalized safe permissions
    const safePerms = {};
    for (const [key, enabled] of normalizedEntries) {
        if (isValidPageKey(key)) {
            // For configurable roles, restricted pages (grantable === false) can never be granted
            safePerms[key] = isGrantablePage(key) ? enabled : false;
        }
    }

    // 1. Sync all existing employees of this role
    const users = await User.find({ role: roleKey });
    let modifiedUsersCount = 0;

    for (const user of users) {
        // Super Admin security check (defense-in-depth: never modify super_admin)
        if (user.role === 'super_admin') continue;

        if (!user.pagePermissions) {
            user.pagePermissions = new Map();
        }

        // Apply normalized permissions
        for (const [pageKey, isEnabled] of Object.entries(safePerms)) {
            if (typeof user.pagePermissions.set === 'function') {
                user.pagePermissions.set(pageKey, isEnabled);
            } else {
                user.pagePermissions[pageKey] = isEnabled;
            }
        }

        // Synchronize additionalPageAccess array
        const currentAccess = new Set((user.additionalPageAccess || []).map(normalizePageKey));
        for (const [pageKey, isEnabled] of Object.entries(safePerms)) {
            if (isEnabled && isGrantablePage(pageKey)) {
                currentAccess.add(pageKey);
            } else {
                currentAccess.delete(pageKey);
            }
        }
        user.additionalPageAccess = [...currentAccess].filter(p => isValidPageKey(p) && isGrantablePage(p));

        if (Array.isArray(roleDefaults.additionalActionPermissions)) {
            user.additionalActionPermissions = roleDefaults.additionalActionPermissions.filter(isValidActionKey);
            user.markModified('additionalActionPermissions');
        }

        user.markModified('pagePermissions');
        user.markModified('additionalPageAccess');
        await user.save();
        invalidateUserCache(user._id);
        modifiedUsersCount++;
    }

    // 2. Sync pending invitations of this role so future employees inherit the updated defaults
    const pendingInvites = await Invitation.find({ role: roleKey, status: 'pending' });
    let modifiedInvitesCount = 0;

    for (const invite of pendingInvites) {
        if (!invite.pagePermissions) {
            invite.pagePermissions = new Map();
        }

        for (const [pageKey, isEnabled] of Object.entries(safePerms)) {
            if (typeof invite.pagePermissions.set === 'function') {
                invite.pagePermissions.set(pageKey, isEnabled);
            } else {
                invite.pagePermissions[pageKey] = isEnabled;
            }
        }

        const inviteAccess = new Set((invite.additionalPageAccess || []).map(normalizePageKey));
        for (const [pageKey, isEnabled] of Object.entries(safePerms)) {
            if (isEnabled && isGrantablePage(pageKey)) {
                inviteAccess.add(pageKey);
            } else {
                inviteAccess.delete(pageKey);
            }
        }
        invite.additionalPageAccess = [...inviteAccess].filter(p => isValidPageKey(p) && isGrantablePage(p));

        if (Array.isArray(roleDefaults.additionalActionPermissions)) {
            invite.additionalActionPermissions = roleDefaults.additionalActionPermissions.filter(isValidActionKey);
            invite.markModified('additionalActionPermissions');
        }

        invite.markModified('pagePermissions');
        invite.markModified('additionalPageAccess');
        await invite.save();
        modifiedInvitesCount++;
    }

    return { modifiedUsersCount, modifiedInvitesCount };
};

// @desc    Update global business settings
// @route   PUT /api/settings
// @access  Private (Admin/SuperAdmin)
export const updateSettings = async (req, res) => {
    try {
        let settings = await Setting.findOne();
        
        const updateData = { ...req.body };

        // Parse businessHours if sent as string (from FormData)
        if (typeof updateData.businessHours === 'string') {
            try {
                updateData.businessHours = JSON.parse(updateData.businessHours);
            } catch (e) {
                console.error("Error parsing businessHours:", e);
                return res.status(400).json({ success: false, error: "Invalid businessHours format" });
            }
        }

        if (typeof updateData.defaultEmployeePermissions === 'string') {
            try {
                updateData.defaultEmployeePermissions = JSON.parse(updateData.defaultEmployeePermissions);
            } catch (e) {
                console.error("Error parsing defaultEmployeePermissions:", e);
                return res.status(400).json({ success: false, error: "Invalid defaultEmployeePermissions format" });
            }
        }

        if (req.file) {
            const cloudinary = getCloudinary();
            if (!cloudinary) {
                return res.status(500).json({ success: false, message: 'Cloudinary not configured' });
            }
            const logoUrl = await new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    { folder: 'gsk_settings', allowed_formats: ['jpg', 'png', 'jpeg', 'webp'] },
                    (error, result) => {
                        if (error) reject(error);
                        else resolve(result.secure_url);
                    }
                );
                stream.end(req.file.buffer);
            });
            updateData.logoUrl = logoUrl;
        }

        let adminDefaultsChanged = false;
        let mechanicDefaultsChanged = false;
        let oldAdminDefaults = null;
        let oldMechanicDefaults = null;

        if (settings) {
            if (updateData.defaultEmployeePermissions?.admin && JSON.stringify(settings.defaultEmployeePermissions?.admin) !== JSON.stringify(updateData.defaultEmployeePermissions.admin)) {
                adminDefaultsChanged = true;
                oldAdminDefaults = settings.defaultEmployeePermissions.admin;
            }
            if (updateData.defaultEmployeePermissions?.mechanic && JSON.stringify(settings.defaultEmployeePermissions?.mechanic) !== JSON.stringify(updateData.defaultEmployeePermissions.mechanic)) {
                mechanicDefaultsChanged = true;
                oldMechanicDefaults = settings.defaultEmployeePermissions.mechanic;
            }
        }

        if (!settings) {
            settings = new Setting(updateData);
            if (updateData.defaultEmployeePermissions) {
                settings.markModified('defaultEmployeePermissions');
            }
            await settings.save();
        } else {
            // Update fields
            Object.assign(settings, updateData);
            if (updateData.defaultEmployeePermissions) {
                settings.markModified('defaultEmployeePermissions');
            }
            if (updateData.businessHours) {
                settings.markModified('businessHours');
            }
            await settings.save();
        }
        invalidateSettingsCache();

        let syncedAdmin = { modifiedUsersCount: 0, modifiedInvitesCount: 0 };
        let syncedMechanic = { modifiedUsersCount: 0, modifiedInvitesCount: 0 };

        if (updateData.defaultEmployeePermissions) {
            if (updateData.defaultEmployeePermissions.admin) {
                syncedAdmin = await syncEmployeesWithRoleDefaults('admin', updateData.defaultEmployeePermissions.admin);
            }
            if (updateData.defaultEmployeePermissions.mechanic) {
                syncedMechanic = await syncEmployeesWithRoleDefaults('mechanic', updateData.defaultEmployeePermissions.mechanic);
            }
        }

        if (adminDefaultsChanged) {
            await AuditLog.create({
                actor: req.user._id,
                action: 'UPDATE_EMPLOYEE_DEFAULTS',
                target: settings._id.toString(),
                metadata: {
                    role: 'admin',
                    previous: oldAdminDefaults,
                    new: updateData.defaultEmployeePermissions.admin,
                    syncedUsersCount: syncedAdmin.modifiedUsersCount,
                    syncedInvitesCount: syncedAdmin.modifiedInvitesCount
                },
                ipAddress: req.ip
            });
        }
        
        if (mechanicDefaultsChanged) {
            await AuditLog.create({
                actor: req.user._id,
                action: 'UPDATE_EMPLOYEE_DEFAULTS',
                target: settings._id.toString(),
                metadata: {
                    role: 'mechanic',
                    previous: oldMechanicDefaults,
                    new: updateData.defaultEmployeePermissions.mechanic,
                    syncedUsersCount: syncedMechanic.modifiedUsersCount,
                    syncedInvitesCount: syncedMechanic.modifiedInvitesCount
                },
                ipAddress: req.ip
            });
        }

        const standardUpdatedFields = Object.keys(updateData).filter(k => k !== 'defaultEmployeePermissions' || (!adminDefaultsChanged && !mechanicDefaultsChanged));
        if (standardUpdatedFields.length > 0) {
            await AuditLog.create({
                actor: req.user._id,
                action: 'UPDATE_SETTINGS',
                target: settings._id.toString(),
                metadata: { updatedFields: standardUpdatedFields },
                ipAddress: req.ip
            });
        }

        res.status(200).json({
            success: true,
            data: settings
        });
    } catch (error) {
        console.error("Error updating settings:", error);
        res.status(500).json({ success: false, error: "Server Error updating settings" });
    }
};
