import express from "express";
import {
  getAllAdmins,
  inviteAdmin,
  getPendingInvites,
  revokeInvite,
  changeRole,
  toggleAccountStatus,
  removeAdmin,
  getProfile,
  updateProfile,
  updatePassword,
  updatePermissions,
  getTechnicians,
  resendInvite,
  seedDemoDataController
} from "../controllers/adminController.js";
import { getAuditLogById, getAuditLogs } from "../controllers/auditController.js";
import { runAudit } from "../utils/audit.js";
import protect, { authorizeRoles, requirePermission } from "../middleware/auth.js";
import { PERMISSIONS } from "../middleware/permissions.js";

const router = express.Router();

// ALL routes below require the user to be logged in
router.use(protect);

router.route("/")
  .get(requirePermission(PERMISSIONS.VIEW_ADMIN_DASHBOARD), getAllAdmins);

router.route("/technicians")
  .get(authorizeRoles('admin', 'super_admin', 'mechanic'), getTechnicians);

router.route("/system-audit")
  .get(authorizeRoles('super_admin'), runAudit);

router.route("/seed-demo-data")
  .post(authorizeRoles('super_admin'), seedDemoDataController);

router.route("/profile")
  .get(getProfile)
  .put(updateProfile);

router.route("/password")
  .put(updatePassword);

router.route("/invite")
  .post(requirePermission(PERMISSIONS.INVITE_ADMINS), inviteAdmin);

router.route("/invitations")
  .get(requirePermission(PERMISSIONS.MANAGE_INVITATIONS), getPendingInvites);

router.route("/invitations/:id/revoke")
  .put(requirePermission(PERMISSIONS.MANAGE_INVITATIONS), revokeInvite);

router.route("/invitations/:id/resend")
  .post(requirePermission(PERMISSIONS.MANAGE_INVITATIONS), resendInvite);

router.route("/audit-logs")
  .get(authorizeRoles('admin', 'super_admin'), requirePermission('auditLogs.view'), getAuditLogs);

router.route("/audit-logs/:id")
  .get(authorizeRoles('admin', 'super_admin'), requirePermission('auditLogs.view'), getAuditLogById);

router.route("/:id")
  .delete(requirePermission(PERMISSIONS.REMOVE_ADMINS), removeAdmin);

router.route("/:id/role")
  .patch(requirePermission(PERMISSIONS.CHANGE_ADMIN_ROLES), changeRole);

router.route("/:id/permissions")
  .patch(requirePermission(PERMISSIONS.MANAGE_PAGE_ACCESS), updatePermissions);

router.route("/:id/status")
  .patch(requirePermission(PERMISSIONS.DISABLE_ACCOUNTS), toggleAccountStatus);

export default router;
