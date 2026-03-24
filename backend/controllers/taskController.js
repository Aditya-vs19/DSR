import {
  createNotification,
  createTask,
  getDepartmentAdminPerformance,
  getEmployeeDailySummary,
  getEmployeeTimeline,
  getTaskUpdateNotificationRecipients,
  getTaskById,
  getTasksByRole,
  getTeamPerformance,
  getUserNotifications,
  markNotificationAsRead,
  updateTaskStatus
} from "../models/taskModel.js";

const validStatuses = ["Pending", "Completed"];

export const createTaskController = async (req, res) => {
  try {
    const { client, task, action, status, dependency, assignedTo, type, deadline } = req.body;
    const assignedBy = req.user.id;

    if (!client || !task || !action || !assignedTo || !type) {
      return res.status(400).json({ message: "Missing required task fields" });
    }

    if (!["self", "assigned"].includes(type)) {
      return res.status(400).json({ message: "Task type must be self or assigned" });
    }

    if (req.user.role === "employee" && (type !== "self" || Number(assignedTo) !== Number(req.user.id))) {
      return res.status(403).json({ message: "Employees can create only self tasks" });
    }

    const normalizedStatus = status === "Completed" ? "Completed" : "Pending";

    const taskId = await createTask({
      client,
      task,
      action,
      status: normalizedStatus,
      dependency,
      assignedTo,
      assignedBy,
      type,
      deadline
    });

    if (Number(assignedTo) !== Number(assignedBy)) {
      await createNotification({
        userId: assignedTo,
        message: `New task assigned: ${task}`,
        type: "task_assigned",
        refId: taskId
      });
    }

    return res.status(201).json({ message: "Task created", id: taskId });
  } catch (error) {
    return res.status(500).json({ message: "Failed to create task", error: error.message });
  }
};

export const getTasksController = async (req, res) => {
  try {
    const { role, id: userId, team } = req.user;
    const tasks = await getTasksByRole({ role, userId, team });
    return res.status(200).json(tasks);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch tasks", error: error.message });
  }
};

export const updateTaskStatusController = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, dependency = null } = req.body;

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const task = await getTaskById(id);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const canEdit =
      req.user.role === "superadmin" ||
      req.user.role === "hr" ||
      task.assigned_to === req.user.id ||
      task.assigned_by === req.user.id;

    if (!canEdit) {
      return res.status(403).json({ message: "Not allowed to update this task" });
    }

    await updateTaskStatus({ id, status, dependency });

    const recipientIds = await getTaskUpdateNotificationRecipients({
      assignedBy: task.assigned_by,
      actorId: req.user.id
    });

    if (recipientIds.length > 0) {
      await Promise.all(
        recipientIds.map((recipientId) =>
          createNotification({
            userId: recipientId,
            message: `${req.user.name} updated task "${task.task}" to ${status}`,
            type: "task_status_updated",
            refId: task.id
          })
        )
      );
    }

    return res.status(200).json({ message: "Task updated" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update task", error: error.message });
  }
};

export const getEmployeeSummaryController = async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const employeeId = req.user.id;
    const summary = await getEmployeeDailySummary(employeeId, date);
    return res.status(200).json(summary);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch summary", error: error.message });
  }
};

export const getEmployeeTimelineController = async (req, res) => {
  try {
    const days = Number(req.query.days || 7);
    const timeline = await getEmployeeTimeline(req.user.id, days);
    return res.status(200).json(timeline);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch timeline", error: error.message });
  }
};

export const getTeamPerformanceController = async (req, res) => {
  try {
    const team = req.user.role === "admin" ? req.user.team : req.query.team;
    if (!team && req.user.role === "admin") {
      return res.status(400).json({ message: "Admin team missing" });
    }

    const data = await getTeamPerformance(team);
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch performance", error: error.message });
  }
};

export const getDepartmentAdminPerformanceController = async (req, res) => {
  try {
    const data = await getDepartmentAdminPerformance(req.query.team || null);
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch admin performance", error: error.message });
  }
};

export const getNotificationsController = async (req, res) => {
  try {
    const notifications = await getUserNotifications(req.user.id);
    return res.status(200).json(notifications);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch notifications", error: error.message });
  }
};

export const markNotificationReadController = async (req, res) => {
  try {
    await markNotificationAsRead(req.params.id, req.user.id);
    return res.status(200).json({ message: "Notification marked as read" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update notification", error: error.message });
  }
};
