import {
  createNotification,
  createTask,
  getDepartmentAdminPerformance,
  getEmployeeDailySummary,
  getEmployeeTimeline,
  getTaskUpdateNotificationRecipients,
  getTaskById,
  getTasksByRole,
  getHrUserIds,
  reassignTask,
  getTeamPerformance,
  getUserNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  submitTaskToHr,
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
      req.user.role === "admin" ||
      req.user.role === "superadmin" ||
      req.user.role === "hr" ||
      Number(task.assigned_to) === Number(req.user.id) ||
      Number(task.assigned_by) === Number(req.user.id);

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

export const reassignTaskController = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admins can reassign tasks" });
    }

    const { id } = req.params;
    const { assignedTo } = req.body;

    const nextAssigneeId = Number(assignedTo);
    if (!Number.isInteger(nextAssigneeId) || nextAssigneeId <= 0) {
      return res.status(400).json({ message: "Valid assignedTo is required" });
    }

    const task = await getTaskById(id);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    if (task.status === "Completed") {
      return res.status(400).json({ message: "Completed tasks cannot be reassigned" });
    }

    if (Number(task.assigned_to) === nextAssigneeId) {
      return res.status(400).json({ message: "Task already assigned to this user" });
    }

    const currentAssignee = await findUserById(task.assigned_to);
    const canReassignTask =
      Number(task.assigned_by) === Number(req.user.id) ||
      (currentAssignee && currentAssignee.team && currentAssignee.team === req.user.team);

    if (!canReassignTask) {
      return res.status(403).json({ message: "You can reassign only your department tasks" });
    }

    const nextAssignee = await findUserById(nextAssigneeId);
    if (!nextAssignee || nextAssignee.role !== "employee") {
      return res.status(400).json({ message: "Task can be reassigned only to an employee" });
    }

    if (!req.user.team || nextAssignee.team !== req.user.team) {
      return res.status(403).json({ message: "You can reassign only within your department" });
    }

    await reassignTask({
      id,
      assignedTo: nextAssigneeId,
      assignedBy: req.user.id
    });

    await createNotification({
      userId: nextAssignee.id,
      message: `${req.user.name} reassigned task "${task.task}" to you`,
      type: "task_assigned",
      refId: Number(id)
    });

    if (currentAssignee && Number(currentAssignee.id) !== nextAssigneeId) {
      await createNotification({
        userId: currentAssignee.id,
        message: `${req.user.name} reassigned task "${task.task}" to ${nextAssignee.name}`,
        type: "task_reassigned",
        refId: Number(id)
      });
    }

    return res.status(200).json({
      message: "Task reassigned successfully",
      task: {
        ...task,
        assigned_to: nextAssignee.id,
        assigned_by: req.user.id,
        assigned_to_name: nextAssignee.name,
        assigned_by_name: req.user.name,
        submitted_to_hr: 0,
        submitted_to_hr_at: null
      }
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to reassign task", error: error.message });
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

export const markAllNotificationsReadController = async (req, res) => {
  try {
    await markAllNotificationsAsRead(req.user.id);
    return res.status(200).json({ message: "All notifications marked as read" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update notifications", error: error.message });
  }
};

export const submitTaskToHrController = async (req, res) => {
  try {
    if (req.user.role !== "employee") {
      return res.status(403).json({ message: "Only employees can submit tasks to HR" });
    }

    const { id } = req.params;
    const result = await submitTaskToHr({ id, employeeId: req.user.id });

    if (!result.task) {
      return res.status(404).json({ message: "Task not found" });
    }

    if (result.forbidden) {
      return res.status(403).json({ message: "You can submit only your own tasks" });
    }

    if (!result.changed) {
      return res.status(200).json({ message: "Task already submitted to HR" });
    }

    const hrIds = await getHrUserIds();

    if (hrIds.length > 0) {
      await Promise.all(
        hrIds.map((hrId) =>
          createNotification({
            userId: hrId,
            message: `${req.user.name} submitted task "${result.task.task}" to HR`,
            type: "task_submitted_to_hr",
            refId: Number(id)
          })
        )
      );
    }

    return res.status(200).json({ message: "Task submitted to HR" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to submit task to HR", error: error.message });
  }
};
