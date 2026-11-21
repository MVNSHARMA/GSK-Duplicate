import express from "express";
import { getDashboardStats } from "../controllers/dashboardController.js";
import protect, { requirePageAccess, requirePermission } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);
router.use(requirePageAccess('dashboard'));

router.route("/")
  .get(requirePermission('dashboard.view'), getDashboardStats);

export default router;
