import crypto from "crypto";
import User from "../models/User.js";
import Invitation from "../models/Invitation.js";
import AuditLog from "../models/AuditLog.js";
import sendEmail from "../utils/sendEmail.js";
import { buildAuthEmail } from "../utils/emailTemplates.js";
import {
  ACTION_KEYS,
  PAGE_KEYS,
  getEffectiveActionPermissions,
  getEffectivePageAccess,
  isGrantableAction,
  isGrantablePage,
  isValidActionKey,
  isValidPageKey,
  normalizePageKey
} from "../middleware/permissions.js";
import { AUDIT_EVENTS } from "../utils/auditEvents.js";
import { escapeRegex } from "../utils/sanitize.js";
import { invalidateUserCache } from "../middleware/auth.js";

/**
 * GET /api/admins
 * Get all users with admin or super_admin roles.
 */
export const getAllAdmins = async (req, res) => {
  try {
    const admins = await User.find({ role: { $in: ["admin", "super_admin", "mechanic"] } }).select("-password").lean();
    res.status(200).json({ success: true, count: admins.length, data: admins });
  } catch (error) {
    res.status(500).json({ success: false, error: "Server error retrieving admins" });
  }
};

/**
 * Get all users with mechanic role (technicians).
 */
export const getTechnicians = async (req, res) => {
  try {
    const { search, limit = 50 } = req.query;
    
    let query = { role: "mechanic", status: "active" };

    if (search) {
      const safeSearch = escapeRegex(search.trim());
      query.$or = [
        { name: { $regex: safeSearch, $options: 'i' } },
        { email: { $regex: safeSearch, $options: 'i' } },
        { phone: { $regex: safeSearch, $options: 'i' } }
      ];
    }

    const technicians = await User.find(query)
      .select("name email phone")
      .limit(parseInt(limit));

    res.status(200).json({ success: true, count: technicians.length, data: technicians });
  } catch (error) {
    res.status(500).json({ success: false, error: "Server error retrieving technicians" });
  }
};

/**
 * POST /api/admins/invite
 * Create an invitation for a new admin.
 */
import Setting from '../models/Setting.js';

export const inviteAdmin = async (req, res) => {
  try {
    let { email, role, pagePermissions, additionalPageAccess = [], additionalActionPermissions = [] } = req.body;

    const allowedRoles = ["super_admin", "admin", "mechanic"];
    const assignedRole = allowedRoles.includes(role) ? role : "admin";
    const roleKey = assignedRole === "mechanic" ? "mechanic" : "admin";

    if (!pagePermissions) {
      const settings = await Setting.findOne();
      if (settings && settings.defaultEmployeePermissions && settings.defaultEmployeePermissions[roleKey]) {
        const roleDefaults = settings.defaultEmployeePermissions[roleKey];
        const rawDefaults = roleDefaults.pagePermissions;
        const normalizedDefaults = {};
        if (rawDefaults) {
          const entries = typeof rawDefaults.entries === 'function'
            ? Array.from(rawDefaults.entries())
            : Object.entries(rawDefaults);
          entries.forEach(([k, v]) => {
            normalizedDefaults[normalizePageKey(k)] = Boolean(v);
          });
        }
        pagePermissions = normalizedDefaults;

        if (additionalPageAccess.length === 0) {
          additionalPageAccess = (roleDefaults.additionalPageAccess || []).map(normalizePageKey);
          if (additionalPageAccess.length === 0) {
            additionalPageAccess = Object.entries(normalizedDefaults)
              .filter(([_, enabled]) => Boolean(enabled))
              .map(([pageKey]) => pageKey)
              .filter(p => isValidPageKey(p) && isGrantablePage(p));
          }
        }
        if (additionalActionPermissions.length === 0) {
          additionalActionPermissions = roleDefaults.additionalActionPermissions || [];
        }
      }
    }

    if (Array.isArray(additionalPageAccess)) {
      additionalPageAccess = [...new Set(additionalPageAccess.map(normalizePageKey))]
        .filter(p => isValidPageKey(p) && isGrantablePage(p));
    }

    if (!email) {
      return res.status(400).json({ success: false, error: "Please provide an email address" });
    }

    if (!Array.isArray(additionalPageAccess) ||
      additionalPageAccess.some((page) => !isValidPageKey(page) || !isGrantablePage(page)) ||
      new Set(additionalPageAccess).size !== additionalPageAccess.length) {
      return res.status(400).json({ success: false, error: "Invalid page access" });
    }
    if (!Array.isArray(additionalActionPermissions) ||
      additionalActionPermissions.some((action) => !isValidActionKey(action) || !isGrantableAction(action)) ||
      new Set(additionalActionPermissions).size !== additionalActionPermissions.length) {
      return res.status(400).json({ success: false, error: "Invalid action permission" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, error: "User with this email already exists" });
    }

    let invitation = await Invitation.findOne({ email });
    if (invitation && invitation.status === "pending") {
      return res.status(400).json({ success: false, error: "A pending invitation already exists for this email" });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    if (invitation) {
      invitation.token = hashedToken;
      invitation.role = assignedRole;
      if (pagePermissions) invitation.pagePermissions = pagePermissions;
      invitation.additionalPageAccess = additionalPageAccess;
      invitation.additionalActionPermissions = additionalActionPermissions;
      invitation.status = "pending";
      invitation.expiresAt = expiresAt;
      invitation.invitedBy = req.user._id;
      await invitation.save();
    } else {
      invitation = await Invitation.create({
        email,
        role: assignedRole,
        pagePermissions: pagePermissions || undefined,
        additionalPageAccess,
        additionalActionPermissions,
        token: hashedToken,
        expiresAt,
        invitedBy: req.user._id
      });
    }

    await AuditLog.create({
      actor: req.user._id,
      action: AUDIT_EVENTS.INVITATION_CREATED,
      target: invitation._id,
      metadata: { email, role: assignedRole },
      ipAddress: req.ip
    });

    const baseUrl = process.env.FRONTEND_URL || 'https://gskautomotive.vercel.app';
    const inviteUrl = `${baseUrl}/accept-invite?token=${token}`;
    
    const message = buildAuthEmail(null, {
      title: "Welcome to GSK Automotive",
      customerName: "Admin",
      message: `You have been invited to join the GSK Automotive Admin Portal with the role of <strong>${assignedRole}</strong>. Please click the button below to set up your account.`,
      actionText: "Accept Invitation",
      actionUrl: inviteUrl
    });

    let emailSent = false;
    try {
      await sendEmail({
        to: email,
        subject: "Invitation to GSK Automotive Admin Portal",
        html: message,
      });
      emailSent = true;
    } catch (err) {
      console.error("Failed to send invitation email:", err.message || err);
    }

    if (emailSent) {
      res.status(201).json({ 
        success: true, 
        data: invitation, 
        message: "Invitation sent successfully." 
      });
    } else {
      res.status(201).json({ 
        success: true, 
        data: invitation, 
        message: "Invitation created, but the email could not be sent. Please use Resend after fixing the email configuration." 
      });
    }

  } catch (error) {
    console.error("Invite Error:", error);
    res.status(500).json({ success: false, error: "Server error creating invitation" });
  }
};

/**
 * GET /api/admins/invitations
 * Get all pending invitations.
 */
export const getPendingInvites = async (req, res) => {
  try {
    const invites = await Invitation.find({ status: "pending" }).populate("invitedBy", "name email");
    res.status(200).json({ success: true, count: invites.length, data: invites });
  } catch (error) {
    res.status(500).json({ success: false, error: "Server error retrieving invitations" });
  }
};

/**
 * PUT /api/admins/invitations/:id/revoke
 * Revoke a pending invitation.
 */
export const revokeInvite = async (req, res) => {
  try {
    const invitation = await Invitation.findById(req.params.id);

    if (!invitation) {
      return res.status(404).json({ success: false, error: "Invitation not found" });
    }

    invitation.status = "revoked";
    invitation.revokedAt = new Date();
    await invitation.save();

    await AuditLog.create({
      actor: req.user._id,
      action: AUDIT_EVENTS.INVITATION_REVOKED,
      target: invitation._id,
      metadata: { email: invitation.email },
      ipAddress: req.ip
    });

    res.status(200).json({ success: true, data: invitation });
  } catch (error) {
    res.status(500).json({ success: false, error: "Server error revoking invitation" });
  }
};

/**
 * POST /api/admins/invitations/:id/resend
 * Resend a pending or expired invitation.
 */
export const resendInvite = async (req, res) => {
  try {
    const invitation = await Invitation.findById(req.params.id);

    if (!invitation) {
      return res.status(404).json({ success: false, error: "Invitation not found" });
    }

    if (invitation.status === "accepted") {
      return res.status(400).json({ success: false, error: "Invitation already accepted" });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    invitation.token = hashedToken;
    invitation.status = "pending";
    invitation.expiresAt = expiresAt;
    invitation.invitedBy = req.user._id;
    await invitation.save();

    await AuditLog.create({
      actor: req.user._id,
      action: AUDIT_EVENTS.INVITATION_CREATED,
      target: invitation._id,
      metadata: { email: invitation.email, role: invitation.role, note: "Resent invitation" },
      ipAddress: req.ip
    });

    const baseUrl = process.env.FRONTEND_URL || 'https://gskautomotive.vercel.app';
    const inviteUrl = `${baseUrl}/accept-invite?token=${token}`;
    
    const message = buildAuthEmail(null, {
      title: "Welcome to GSK Automotive",
      customerName: "Admin",
      message: `You have been invited to join the GSK Automotive Admin Portal with the role of <strong>${invitation.role}</strong>. Please click the button below to set up your account.`,
      actionText: "Accept Invitation",
      actionUrl: inviteUrl
    });

    let emailSent = false;
    try {
      await sendEmail({
        to: invitation.email,
        subject: "Invitation to GSK Automotive Admin Portal",
        html: message,
      });
      emailSent = true;
    } catch (err) {
      console.error("Failed to send resent invitation email:", err.message || err);
    }

    if (emailSent) {
      res.status(200).json({ 
        success: true, 
        data: invitation, 
        message: "Invitation resent successfully." 
      });
    } else {
      res.status(200).json({ 
        success: true, 
        data: invitation, 
        message: "Invitation reset, but the email could not be sent. Please check email configuration." 
      });
    }

  } catch (error) {
    console.error("Resend Invite Error:", error);
    res.status(500).json({ success: false, error: "Server error resending invitation" });
  }
};

/**
 * PATCH /api/admins/:id/role
 * Change an admin's role.
 */
export const changeRole = async (req, res) => {
  try {
    const { role } = req.body;
    const targetUserId = req.params.id;

    const allowedRoles = ["admin", "super_admin", "mechanic"];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ success: false, error: "Invalid role specified" });
    }

    if (targetUserId === req.user._id.toString()) {
      return res.status(400).json({ success: false, error: "You cannot change your own role" });
    }

    if (role === "super_admin" && req.user.role !== "super_admin") {
      return res.status(403).json({ 
        success: false, 
        error: "Only Super Admins can promote an employee to Super Admin" 
      });
    }

    const userToUpdate = await User.findById(targetUserId);

    if (!userToUpdate) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    if (userToUpdate.role === "super_admin" && req.user.role !== "super_admin") {
      return res.status(403).json({ 
        success: false, 
        error: "You cannot change the role of a super admin account." 
      });
    }

    const previousRole = userToUpdate.role;
    userToUpdate.role = role;

    // Apply destination role defaults if destination role is a configurable employee role
    if (['admin', 'mechanic'].includes(role)) {
      const settings = await Setting.findOne();
      const roleDefaults = settings?.defaultEmployeePermissions?.[role];
      if (roleDefaults && roleDefaults.pagePermissions) {
        const rawPerms = roleDefaults.pagePermissions;
        const normalizedPerms = {};
        const entries = typeof rawPerms.entries === 'function'
          ? Array.from(rawPerms.entries())
          : Object.entries(rawPerms);

        entries.forEach(([k, v]) => {
          const normKey = normalizePageKey(k);
          if (isValidPageKey(normKey)) {
            normalizedPerms[normKey] = isGrantablePage(normKey) ? Boolean(v) : false;
          }
        });

        // Reset page permissions completely to destination role defaults
        userToUpdate.pagePermissions = new Map();
        for (const pageKey of PAGE_KEYS) {
          if (isGrantablePage(pageKey)) {
            userToUpdate.pagePermissions.set(pageKey, Boolean(normalizedPerms[pageKey]));
          } else {
            userToUpdate.pagePermissions.set(pageKey, false);
          }
        }

        const newAccess = Object.entries(normalizedPerms)
          .filter(([_, isEnabled]) => Boolean(isEnabled) && isGrantablePage(_))
          .map(([pageKey]) => pageKey);
        userToUpdate.additionalPageAccess = newAccess;

        if (Array.isArray(roleDefaults.additionalActionPermissions)) {
          userToUpdate.additionalActionPermissions = roleDefaults.additionalActionPermissions.filter(isValidActionKey);
          userToUpdate.markModified('additionalActionPermissions');
        }

        userToUpdate.markModified('pagePermissions');
        userToUpdate.markModified('additionalPageAccess');
      }
    }

    await userToUpdate.save();
    invalidateUserCache(userToUpdate._id);

    await AuditLog.create({
      actor: req.user._id,
      action: AUDIT_EVENTS.ROLE_CHANGED,
      target: userToUpdate._id,
      actorName: req.user.name,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      targetUser: userToUpdate._id,
      targetName: userToUpdate.name,
      entityType: 'Employee',
      entityId: userToUpdate._id.toString(),
      entityDisplay: userToUpdate.name || userToUpdate.email,
      description: `Changed role of ${userToUpdate.name || userToUpdate.email} from ${previousRole} to ${role}`,
      metadata: { email: userToUpdate.email, fromRole: previousRole, toRole: role },
      ipAddress: req.ip
    });

    res.status(200).json({
      success: true,
      data: {
        ...userToUpdate.toObject(),
        effectivePageAccess: getEffectivePageAccess(userToUpdate),
        effectiveActionPermissions: getEffectiveActionPermissions(userToUpdate)
      }
    });
  } catch (error) {
    console.error("Change role error:", error);
    res.status(500).json({ success: false, error: "Server error changing role" });
  }
};

/**
 * PATCH /api/admins/:id/status
 * Enable or disable an admin account.
 */
export const toggleAccountStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const targetUserId = req.params.id;

    if (targetUserId === req.user._id.toString()) {
      return res.status(400).json({ success: false, error: "You cannot change your own account status" });
    }

    if (!["active", "disabled"].includes(status)) {
      return res.status(400).json({ success: false, error: "Invalid status value" });
    }

    const userToUpdate = await User.findById(targetUserId);

    if (!userToUpdate) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    if (userToUpdate.role === "super_admin") {
      return res.status(403).json({ 
        success: false, 
        error: "You cannot change the status of another super admin account." 
      });
    }

    const previousStatus = userToUpdate.status;
    userToUpdate.status = status;
    await userToUpdate.save();
    invalidateUserCache(userToUpdate._id);

    await AuditLog.create({
      actor: req.user._id,
      action: status === 'disabled' ? AUDIT_EVENTS.ACCOUNT_DISABLED : AUDIT_EVENTS.ACCOUNT_ENABLED,
      target: userToUpdate._id,
      metadata: { email: userToUpdate.email, fromStatus: previousStatus, toStatus: status },
      ipAddress: req.ip
    });

    res.status(200).json({ success: true, data: userToUpdate });
  } catch (error) {
    res.status(500).json({ success: false, error: "Server error toggling status" });
  }
};

/**
 * DELETE /api/admins/:id
 * Remove an admin user.
 */
export const removeAdmin = async (req, res) => {
  try {
    const targetUserId = req.params.id;

    if (targetUserId === req.user._id.toString()) {
      return res.status(400).json({ success: false, error: "You cannot remove your own account" });
    }

    const userToRemove = await User.findById(targetUserId);

    if (!userToRemove) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    if (userToRemove.role === "super_admin") {
      return res.status(403).json({ 
        success: false, 
        error: "You cannot delete another super admin account." 
      });
    }

    await User.findByIdAndDelete(targetUserId);
    invalidateUserCache(targetUserId);

    await AuditLog.create({
      actor: req.user._id,
      action: AUDIT_EVENTS.EMPLOYEE_REMOVED,
      target: targetUserId,
      metadata: { email: userToRemove.email, role: userToRemove.role },
      ipAddress: req.ip
    });

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, error: "Server error removing admin" });
  }
};

/**
 * GET /api/admins/profile
 * Get current admin profile
 */
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error fetching profile' });
  }
};

/**
 * PUT /api/admins/profile
 * Update current admin profile
 */
export const updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;
    
    // Check if email is being changed and is already taken
    if (email && email !== req.user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ success: false, error: 'Email is already in use' });
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { name: name || req.user.name, email: email || req.user.email },
      { new: true, runValidators: true }
    ).select('-password');
    invalidateUserCache(req.user._id);

    res.status(200).json({ success: true, data: updatedUser });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error updating profile' });
  }
};

/**
 * PUT /api/admins/password
 * Update current admin password
 */
export const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'Please provide current and new password' });
    }

    const user = await User.findById(req.user._id);

    // Check current password
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid current password' });
    }

    user.password = newPassword;
    await user.save();

    await AuditLog.create({
      actor: req.user._id,
      action: AUDIT_EVENTS.PASSWORD_CHANGED,
      target: req.user._id,
      metadata: { },
      ipAddress: req.ip
    });

    res.status(200).json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error updating password' });
  }
};

/**
 * PATCH /api/admins/:id/permissions
 * Update an admin's page permissions.
 */
export const updatePermissions = async (req, res) => {
  try {
    const { type = 'page', page, permission, enabled } = req.body;
    const targetUserId = req.params.id;

    if (targetUserId === req.user._id.toString()) {
      return res.status(400).json({ success: false, error: "You cannot modify your own permissions" });
    }

    const isActionUpdate = type === 'action';
    const rawKey = isActionUpdate ? permission : page;
    const requestedKey = isActionUpdate ? rawKey : normalizePageKey(rawKey);
    const isValidRequest = isActionUpdate
      ? isValidActionKey(requestedKey) && isGrantableAction(requestedKey)
      : isValidPageKey(requestedKey) && isGrantablePage(requestedKey);

    if (!isValidRequest || typeof enabled !== 'boolean') {
      return res.status(400).json({ success: false, error: isActionUpdate ? "Invalid action permission" : "Invalid page access" });
    }

    const userToUpdate = await User.findById(targetUserId);

    if (!userToUpdate) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    if (userToUpdate.role === 'user') {
      return res.status(400).json({ success: false, error: "Customer users cannot receive admin page access" });
    }

    if (userToUpdate.role === 'super_admin') {
      return res.status(403).json({
        success: false,
        error: "Super Admin permissions cannot be modified"
      });
    }

    if (isActionUpdate) {
      const currentActions = new Set(userToUpdate.additionalActionPermissions || []);
      if (enabled) currentActions.add(requestedKey);
      else currentActions.delete(requestedKey);
      userToUpdate.additionalActionPermissions = [...currentActions].filter((actionKey) => ACTION_KEYS.includes(actionKey));
    } else {
      // 1. Update additionalPageAccess
      const currentAccess = new Set((userToUpdate.additionalPageAccess || []).map(normalizePageKey));
      if (enabled) currentAccess.add(requestedKey);
      else currentAccess.delete(requestedKey);
      userToUpdate.additionalPageAccess = [...currentAccess].filter((pageKey) => PAGE_KEYS.includes(pageKey));

      // 2. Update pagePermissions Map
      if (!userToUpdate.pagePermissions) {
        userToUpdate.pagePermissions = new Map();
      }
      if (typeof userToUpdate.pagePermissions.set === 'function') {
        userToUpdate.pagePermissions.set(requestedKey, enabled);
        if (rawKey && rawKey !== requestedKey && userToUpdate.pagePermissions.has(rawKey)) {
          userToUpdate.pagePermissions.set(rawKey, enabled);
        }
      } else {
        userToUpdate.pagePermissions[requestedKey] = enabled;
        if (rawKey && rawKey !== requestedKey) {
          userToUpdate.pagePermissions[rawKey] = enabled;
        }
      }
      userToUpdate.markModified('pagePermissions');
      userToUpdate.markModified('additionalPageAccess');
    }
    
    await userToUpdate.save();
    invalidateUserCache(userToUpdate._id);

    await AuditLog.create({
      actor: req.user._id,
      action: enabled
        ? (isActionUpdate ? AUDIT_EVENTS.ACTION_PERMISSION_GRANTED : AUDIT_EVENTS.PAGE_ACCESS_GRANTED)
        : (isActionUpdate ? AUDIT_EVENTS.ACTION_PERMISSION_REVOKED : AUDIT_EVENTS.PAGE_ACCESS_REVOKED),
      target: userToUpdate._id,
      actorName: req.user.name,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      targetUser: userToUpdate._id,
      targetName: userToUpdate.name,
      entityType: 'Employee',
      entityId: userToUpdate._id.toString(),
      entityDisplay: userToUpdate.name || userToUpdate.email,
      description: `${enabled ? 'Granted' : 'Revoked'} ${isActionUpdate ? permission : page} ${isActionUpdate ? 'action permission' : 'page access'} ${enabled ? 'to' : 'from'} ${userToUpdate.name || userToUpdate.email}`,
      metadata: { email: userToUpdate.email, page, permission, type, enabled },
      ipAddress: req.ip
    });

    res.status(200).json({
      success: true,
      data: {
        ...userToUpdate.toObject(),
        effectivePageAccess: getEffectivePageAccess(userToUpdate),
        effectiveActionPermissions: getEffectiveActionPermissions(userToUpdate)
      }
    });
  } catch (error) {
    console.error("Update permissions error:", error);
    res.status(500).json({ success: false, error: "Server error updating permissions" });
  }
};

/**
 * POST /api/admins/seed-demo-data
 * Populates complete client demo data across all modules (Admin only).
 */
export const seedDemoDataController = async (req, res) => {
  try {
    const { seedCompleteDemoLogic } = await import('../utils/completeDemoSeeder.js');
    await seedCompleteDemoLogic();
    res.status(200).json({
      success: true,
      message: "Comprehensive demo data populated successfully across all modules!"
    });
  } catch (error) {
    console.error("Seed demo data error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};
