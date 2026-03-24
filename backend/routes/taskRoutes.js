import express from "express";
import {
  createTaskController,
  getEmployeeSummaryController,
  getEmployeeTimelineController,
  getNotificationsController,
  getTasksController,
  getTeamPerformanceController,
  markNotificationReadController,
  updateTaskStatusController
} from "../controllers/taskController.js";
import { authenticate, authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authenticate);

router.post("/", createTaskController);
router.get("/", getTasksController);
router.put("/:id", updateTaskStatusController);
router.get("/summary/daily", authorizeRoles("employee"), getEmployeeSummaryController);
router.get("/timeline", authorizeRoles("employee"), getEmployeeTimelineController);
router.get("/performance/team", authorizeRoles("admin", "hr", "superadmin"), getTeamPerformanceController);
router.get("/notifications/me", getNotificationsController);
router.put("/notifications/:id/read", markNotificationReadController);

export default router;
