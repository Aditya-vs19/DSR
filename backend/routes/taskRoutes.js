import express from "express";
import {
  createTaskController,
  deleteTaskController,
  getDepartmentAdminPerformanceController,
  getEmployeeSummaryController,
  getEmployeeTimelineController,
  getNotificationsController,
  markAllNotificationsReadController,
  reassignTaskController,
  getTasksController,
  getTeamPerformanceController,
  markNotificationReadController,
  submitTaskToHrController,
  updateTaskStatusController,
  updateTaskPriorityController
} from "../controllers/taskController.js";
import { authenticate, authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authenticate);

router.post("/", createTaskController);
router.get("/", getTasksController);
router.delete("/:id", deleteTaskController);
router.put("/:id", updateTaskStatusController);
router.put("/:id/priority", updateTaskPriorityController);
router.put("/:id/reassign", authorizeRoles("admin"), reassignTaskController);
router.put("/:id/submit-hr", authorizeRoles("employee", "superadmin"), submitTaskToHrController);
router.get("/summary/daily", authorizeRoles("employee", "superadmin"), getEmployeeSummaryController);
router.get("/timeline", authorizeRoles("employee", "superadmin"), getEmployeeTimelineController);
router.get("/performance/team", authorizeRoles("admin", "hr", "superadmin"), getTeamPerformanceController);
router.get("/performance/admins", authorizeRoles("admin", "hr", "superadmin"), getDepartmentAdminPerformanceController);
router.get("/notifications/me", getNotificationsController);
router.put("/notifications/:id/read", markNotificationReadController);
router.put("/notifications/read-all", markAllNotificationsReadController);

export default router;
