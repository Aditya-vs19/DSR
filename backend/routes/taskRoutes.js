import express from "express";
import {
  createTaskController,
  getDepartmentAdminPerformanceController,
  getEmployeeSummaryController,
  getEmployeeTimelineController,
  getNotificationsController,
  reassignTaskController,
  getTasksController,
  getTeamPerformanceController,
  markNotificationReadController,
  submitTaskToHrController,
  updateTaskStatusController
} from "../controllers/taskController.js";
import { authenticate, authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authenticate);

router.post("/", createTaskController);
router.get("/", getTasksController);
router.put("/:id", updateTaskStatusController);
router.put("/:id/reassign", authorizeRoles("admin"), reassignTaskController);
router.put("/:id/submit-hr", authorizeRoles("employee"), submitTaskToHrController);
router.get("/summary/daily", authorizeRoles("employee"), getEmployeeSummaryController);
router.get("/timeline", authorizeRoles("employee"), getEmployeeTimelineController);
router.get("/performance/team", authorizeRoles("admin", "hr", "superadmin"), getTeamPerformanceController);
router.get("/performance/admins", authorizeRoles("admin", "superadmin"), getDepartmentAdminPerformanceController);
router.get("/notifications/me", getNotificationsController);
router.put("/notifications/:id/read", markNotificationReadController);

export default router;
