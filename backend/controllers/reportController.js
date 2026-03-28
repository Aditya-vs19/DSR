import {
  deleteHolidayById,
  generateDailyReports,
  getReportsByRole,
  getSuperAdminAnalytics,
  listHolidays,
  validateReport,
  getDailyReportGridByRole,
  getDailyReportCellById,
  upsertHoliday,
  updateDailyReportCellStatus,
  submitEmployeeDailyReport,
  getReportDetailsById
} from "../models/reportModel.js";
import { createNotification, getHrUserIds } from "../models/taskModel.js";
import { getManagedTeamsForAdmin } from "../utils/teamScope.js";

const normalizeDateText = (value) => {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
};

const normalizeEmployeeIds = (value) => {
  if (!value) {
    return [];
  }

  const rawList = Array.isArray(value) ? value : String(value).split(",");

  return rawList
    .map((entry) => Number(String(entry).trim()))
    .filter((entry) => Number.isInteger(entry) && entry > 0);
};

export const getReportsController = async (req, res) => {
  try {
    const { role, id: userId, team } = req.user;
    const managedTeams = role === "admin" ? getManagedTeamsForAdmin(req.user) : [];

    if (req.query.dateRange) {
      if (!["admin", "hr", "superadmin"].includes(role)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const grid = await getDailyReportGridByRole({
        role,
        userId,
        team,
        managedTeams,
        dateRange: req.query.dateRange,
        date: req.query.date,
        teamFilter: req.query.team,
        employeeId: req.query.employeeId,
        employeeIds: normalizeEmployeeIds(req.query.employeeIds)
      });

      return res.status(200).json(grid);
    }

    const reports = await getReportsByRole({ role, userId, team, managedTeams });
    return res.status(200).json(reports);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch reports", error: error.message });
  }
};

export const generateReportsController = async (req, res) => {
  try {
    const date = req.body.date || new Date().toISOString().slice(0, 10);
    await generateDailyReports(date);
    return res.status(200).json({ message: "Daily reports generated", date });
  } catch (error) {
    return res.status(500).json({ message: "Report generation failed", error: error.message });
  }
};

export const validateReportController = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Status must be approved or rejected" });
    }

    const result = await validateReport({
      reportId: id,
      status,
      validatedBy: req.user.id
    });

    if (!result?.affectedRows) {
      return res.status(404).json({ message: "Report not found" });
    }

    return res.status(200).json({ message: "Report validated" });
  } catch (error) {
    return res.status(500).json({ message: "Report validation failed", error: error.message });
  }
};

export const getAnalyticsController = async (req, res) => {
  try {
    const analytics = await getSuperAdminAnalytics({
      team: req.query.team || "all",
      date: req.query.date || ""
    });
    return res.status(200).json(analytics);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch analytics", error: error.message });
  }
};

export const updateDailyReportCellController = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const allowedStatuses = ["Received", "Not Received", "Leave"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const cell = await getDailyReportCellById(id);
    if (!cell) {
      return res.status(404).json({ message: "Report cell not found" });
    }

    const managedTeams = req.user.role === "admin" ? getManagedTeamsForAdmin(req.user) : [];

    if (req.user.role === "admin" && !managedTeams.includes(cell.team)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await updateDailyReportCellStatus(id, status);
    return res.status(200).json({ message: "Report status updated", id: Number(id), status });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update report status", error: error.message });
  }
};

export const submitReportToHrController = async (req, res) => {
  try {
    if (!["employee", "admin"].includes(req.user.role)) {
      return res.status(403).json({ message: "Only employees/admins can submit reports" });
    }

    const date = req.body.date || new Date().toISOString().slice(0, 10);
    const isAdminSubmission = req.user.role === "admin";
    const result = await submitEmployeeDailyReport({
      employeeId: req.user.id,
      date,
      onlySelfAssigned: isAdminSubmission
    });

    if (!result.submitted) {
      return res.status(400).json({
        message: isAdminSubmission
          ? "No self-assigned tasks found for selected day"
          : "No tasks found for selected day"
      });
    }

    const hrIds = await getHrUserIds();
    if (hrIds.length > 0) {
      await Promise.all(
        hrIds.map((hrId) =>
          createNotification({
            userId: hrId,
            message: `${req.user.name} submitted daily report for ${date}`,
            type: "daily_report_submitted",
            refId: req.user.id
          })
        )
      );
    }

    return res.status(200).json({
      message: isAdminSubmission ? "Self-task report submitted to HR" : "Report submitted to HR",
      date,
      totalTasks: Number(result.total_tasks || 0),
      completedTasks: Number(result.completed_tasks || 0),
      pendingTasks: Number(result.pending_tasks || 0)
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to submit report", error: error.message });
  }
};

export const getReportDetailsController = async (req, res) => {
  try {
    const { id } = req.params;
    const details = await getReportDetailsById(id);

    if (!details) {
      return res.status(404).json({ message: "Report not found" });
    }

    const managedTeams = req.user.role === "admin" ? getManagedTeamsForAdmin(req.user) : [];

    if (req.user.role === "admin" && !managedTeams.includes(details.report.employee_team)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (req.user.role === "employee" && Number(req.user.id) !== Number(details.report.employee_id)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return res.status(200).json(details);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch report details", error: error.message });
  }
};

export const getHolidaysController = async (req, res) => {
  try {
    const holidays = await listHolidays({
      startDate: req.query.startDate || "",
      endDate: req.query.endDate || ""
    });

    return res.status(200).json(
      holidays.map((entry) => ({
        id: entry.id,
        date: normalizeDateText(entry.holiday_date),
        title: entry.title,
        createdBy: entry.created_by,
        createdAt: entry.created_at,
        updatedAt: entry.updated_at
      }))
    );
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch holidays", error: error.message });
  }
};

export const upsertHolidayController = async (req, res) => {
  try {
    const date = String(req.body.date || "").slice(0, 10);
    const title = String(req.body.title || "").trim();

    if (!date) {
      return res.status(400).json({ message: "Holiday date is required" });
    }

    if (!title) {
      return res.status(400).json({ message: "Holiday title is required" });
    }

    await upsertHoliday({ date, title, createdBy: req.user.id });
    return res.status(200).json({ message: "Holiday saved", date, title });
  } catch (error) {
    return res.status(500).json({ message: "Failed to save holiday", error: error.message });
  }
};

export const deleteHolidayController = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await deleteHolidayById(id);

    if (!result.affectedRows) {
      return res.status(404).json({ message: "Holiday not found" });
    }

    return res.status(200).json({ message: "Holiday removed" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to remove holiday", error: error.message });
  }
};
