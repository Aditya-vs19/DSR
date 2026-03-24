import express from "express";
import {
  generateReportsController,
  getAnalyticsController,
  getReportsController,
  validateReportController
} from "../controllers/reportController.js";
import { authenticate, authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authenticate);

router.get("/", getReportsController);
router.post("/generate", authorizeRoles("admin", "hr", "superadmin"), generateReportsController);
router.put("/:id/validate", authorizeRoles("hr", "superadmin"), validateReportController);
router.get("/analytics/superadmin", authorizeRoles("superadmin"), getAnalyticsController);

export default router;
