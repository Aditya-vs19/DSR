import express from "express";
import {
  deleteHolidayController,
  generateReportsController,
  getAnalyticsController,
  getHolidaysController,
  getReportDetailsController,
  getReportsController,
  submitReportToHrController,
  upsertHolidayController,
  updateDailyReportCellController,
  validateReportController
} from "../controllers/reportController.js";
import { authenticate, authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authenticate);

router.get("/", getReportsController);
router.get("/holidays", authorizeRoles("superadmin"), getHolidaysController);
router.post("/holidays", authorizeRoles("superadmin"), upsertHolidayController);
router.delete("/holidays/:id", authorizeRoles("superadmin"), deleteHolidayController);
router.post("/submit", authorizeRoles("employee", "admin"), submitReportToHrController);
router.post("/generate", authorizeRoles("admin", "hr", "superadmin"), generateReportsController);
router.get("/:id/details", authorizeRoles("admin", "hr", "superadmin"), getReportDetailsController);
router.put("/:id", authorizeRoles("admin", "hr", "superadmin"), updateDailyReportCellController);
router.put("/:id/validate", authorizeRoles("hr", "superadmin"), validateReportController);
router.get("/analytics/superadmin", authorizeRoles("superadmin"), getAnalyticsController);

export default router;
