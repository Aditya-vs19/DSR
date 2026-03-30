import {
  carryForwardPendingTasks,
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
  updateTaskStatus,
  updateTaskPriority
} from "../models/taskModel.js";
import { hasReceivedDailyReport } from "../models/reportModel.js";
import { findUserById } from "../models/userModel.js";
import { getManagedTeamsForAdmin } from "../utils/teamScope.js";

const statusMap = {
  pending: "Pending",
  "in progress": "In Progress",
  inprogress: "In Progress",
  completed: "Completed"
};

const priorityMap = {
  medium: "Medium",
  high: "High",
  critical: "Critical"
};

const normalizeTaskStatus = (value) => {
  const key = String(value || "")
    .trim()
    .toLowerCase();

  return statusMap[key] || null;
};

const normalizeTaskPriority = (value) => {
  const key = String(value || "")
    .trim()
    .toLowerCase();

  return priorityMap[key] || null;
};

export const createTaskController = async (req, res) => {
  try {
    const { client, task, action, status, dependency, assignedTo, type, deadline, priority, taskDepartment } = req.body;
    const assignedBy = req.user.id;
    const normalizedClient = String(client || "").trim();

    if (!task || !action || !assignedTo || !type) {
      return res.status(400).json({ message: "Missing required task fields" });
    }

    if (!["self", "assigned"].includes(type)) {
      return res.status(400).json({ message: "Task type must be self or assigned" });
    }

    if (req.user.role === "employee" && (type !== "self" || Number(assignedTo) !== Number(req.user.id))) {
      return res.status(403).json({ message: "Employees can create only self tasks" });
    }

    if (["employee", "admin"].includes(req.user.role)) {
      const today = new Date().toISOString().slice(0, 10);
      const alreadySubmittedToday = await hasReceivedDailyReport({
        userId: req.user.id,
        date: today
      });

      if (alreadySubmittedToday) {
        return res.status(400).json({
          message: "You already submitted today's report. New tasks can be created tomorrow."
        });
      }
    }

    const assignee = await findUserById(assignedTo);
    if (!assignee) {
      return res.status(404).json({ message: "Assignee not found" });
    }

    const isSelfTask = Number(assignedTo) === Number(req.user.id) && type === "self";
    const isAssignableEmployee = assignee.role === "employee";

    if (!isSelfTask && !isAssignableEmployee) {
      return res.status(400).json({ message: "Tasks can be assigned only to employees" });
    }

    if (req.user.role === "admin" && !isSelfTask) {
      const managedTeams = getManagedTeamsForAdmin(req.user);
      if (!managedTeams.includes(assignee.team)) {
        return res.status(403).json({ message: "You can assign tasks only within your managed teams" });
      }
    }

    const normalizedTaskDepartment = String(taskDepartment || "").trim();
    let resolvedTaskDepartment = null;

    if (normalizedTaskDepartment) {
      const managedTeams = req.user.role === "admin" ? getManagedTeamsForAdmin(req.user) : [];

      if (!(req.user.role === "admin" && isSelfTask)) {
        return res.status(400).json({ message: "Task department can be set only for admin self tasks" });
      }

      if (!managedTeams.includes(normalizedTaskDepartment)) {
        return res.status(400).json({ message: "Invalid task department for current admin" });
      }

      resolvedTaskDepartment = normalizedTaskDepartment;
    }

    const normalizedStatus = normalizeTaskStatus(status) || "Pending";

    const normalizedPriority = normalizeTaskPriority(priority) || "Medium";

    const taskId = await createTask({
      client: normalizedClient,
      task,
      action,
      status: normalizedStatus,
      dependency,
      assignedTo,
      assignedBy,
      type,
      deadline,
      priority: normalizedPriority,
      taskDepartment: resolvedTaskDepartment
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
    const today = new Date().toISOString().slice(0, 10);
    await carryForwardPendingTasks(today);

    const { role, id: userId, team } = req.user;
    const managedTeams = role === "admin" ? getManagedTeamsForAdmin(req.user) : [];
    const tasks = await getTasksByRole({ role, userId, team, managedTeams });
    return res.status(200).json(tasks);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch tasks", error: error.message });
  }
};

export const updateTaskStatusController = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, dependency = null, action = "", taskTitle = "" } = req.body;
    const normalizedStatus = normalizeTaskStatus(status);
    const normalizedAction = String(action || "").trim();
    const normalizedTaskTitle = String(taskTitle || "").trim();

    if (!normalizedStatus) {
      return res.status(400).json({ message: "Invalid status. Use Pending, In Progress, or Completed." });
    }

    if (!normalizedAction) {
      return res.status(400).json({ message: "Action is required" });
    }

    if (!normalizedTaskTitle) {
      return res.status(400).json({ message: "Task title is required" });
    }

    const task = await getTaskById(id);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    if (Number(task.submitted_to_hr) === 1) {
      return res.status(400).json({ message: "Submitted tasks cannot be edited" });
    }

    let assignee = null;
    if (req.user.role === "admin") {
      assignee = await findUserById(task.assigned_to);
    }

    const adminCanEditManagedTeamTask =
      req.user.role === "admin" &&
      assignee &&
      getManagedTeamsForAdmin(req.user).includes(assignee.team);

    const canEdit =
      req.user.role === "superadmin" ||
      req.user.role === "hr" ||
      task.assigned_to === req.user.id ||
      task.assigned_by === req.user.id ||
      adminCanEditManagedTeamTask;

    if (!canEdit) {
      return res.status(403).json({ message: "Not allowed to update this task" });
    }

    await updateTaskStatus({
      id,
      status: normalizedStatus,
      dependency,
      action: normalizedAction,
      taskTitle: normalizedTaskTitle
    });

    const recipientIds = await getTaskUpdateNotificationRecipients({
      assignedBy: task.assigned_by,
      actorId: req.user.id
    });

    if (recipientIds.length > 0) {
      await Promise.all(
        recipientIds.map((recipientId) =>
          createNotification({
            userId: recipientId,
            message: `${req.user.name} updated task "${task.task}"`,
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
      return res.status(400).json({ message: "Task already assigned to this employee" });
    }

    const currentAssignee = await findUserById(task.assigned_to);
    const managedTeams = getManagedTeamsForAdmin(req.user);
    const canReassignTask =
      Number(task.assigned_by) === Number(req.user.id) ||
      (currentAssignee && currentAssignee.team && managedTeams.includes(currentAssignee.team));

    if (!canReassignTask) {
      return res.status(403).json({ message: "You can reassign only your department tasks" });
    }

    const nextAssignee = await findUserById(nextAssigneeId);
    if (!nextAssignee) {
      return res.status(404).json({ message: "Assignee not found" });
    }

    const isSelfReassign = Number(nextAssignee.id) === Number(req.user.id);
    const isAssignableEmployee = nextAssignee.role === "employee" && managedTeams.includes(nextAssignee.team);

    if (!isSelfReassign && !isAssignableEmployee) {
      return res.status(400).json({ message: "Task can be reassigned only to your team employees or yourself" });
    }

    await reassignTask({
      id,
      assignedTo: nextAssigneeId,
      assignedBy: req.user.id
    });

    if (Number(nextAssignee.id) !== Number(req.user.id)) {
      await createNotification({
        userId: nextAssignee.id,
        message: `${req.user.name} reassigned task "${task.task}" to you`,
        type: "task_assigned",
        refId: Number(id)
      });
    }

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
        reassigned_at: new Date().toISOString().slice(0, 19).replace("T", " "),
        submitted_to_hr: 0,
        submitted_to_hr_at: null
      }
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to reassign task", error: error.message });
  }
};

export const updateTaskPriorityController = async (req, res) => {
  try {
    const { id } = req.params;
    const { priority } = req.body;
    const normalizedPriority = normalizeTaskPriority(priority);

    if (!normalizedPriority) {
      return res.status(400).json({ message: "Invalid priority. Use Medium, High, or Critical." });
    }

    const task = await getTaskById(id);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    if (Number(task.submitted_to_hr) === 1) {
      return res.status(400).json({ message: "Submitted tasks cannot be edited" });
    }

    let assignee = null;
    if (req.user.role === "admin") {
      assignee = await findUserById(task.assigned_to);
    }

    const adminCanEditManagedTeamTask =
      req.user.role === "admin" &&
      assignee &&
      getManagedTeamsForAdmin(req.user).includes(assignee.team);

    const canEdit =
      req.user.role === "superadmin" ||
      req.user.role === "hr" ||
      task.assigned_to === req.user.id ||
      task.assigned_by === req.user.id ||
      adminCanEditManagedTeamTask;

    if (!canEdit) {
      return res.status(403).json({ message: "Not allowed to update this task" });
    }

    await updateTaskPriority({ id, priority: normalizedPriority });
    return res.status(200).json({ message: "Priority updated successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update priority", error: error.message });
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
    const managedTeams = req.user.role === "admin" ? getManagedTeamsForAdmin(req.user) : [];
    const team = req.user.role === "admin" ? managedTeams : req.query.team;

    if (req.user.role === "admin" && managedTeams.length === 0) {
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
