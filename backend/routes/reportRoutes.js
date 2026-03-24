import express from "express";
import {
  generateReportsController,
  getAnalyticsController,
  getReportDetailsController,
  getReportsController,
  submitReportToHrController,
  updateDailyReportCellController,
  validateReportController
} from "../controllers/reportController.js";
import { authenticate, authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authenticate);

router.get("/", getReportsController);
router.post("/submit", authorizeRoles("employee"), submitReportToHrController);
router.post("/generate", authorizeRoles("admin", "hr", "superadmin"), generateReportsController);
router.get("/:id/details", authorizeRoles("admin", "hr", "superadmin"), getReportDetailsController);
router.put("/:id", authorizeRoles("admin", "hr", "superadmin"), updateDailyReportCellController);
router.put("/:id/validate", authorizeRoles("hr", "superadmin"), validateReportController);
router.get("/analytics/superadmin", authorizeRoles("superadmin"), getAnalyticsController);

export default router;
