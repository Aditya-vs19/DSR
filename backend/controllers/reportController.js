import {
  generateDailyReports,
  getReportsByRole,
  getSuperAdminAnalytics,
  validateReport
} from "../models/reportModel.js";

export const getReportsController = async (req, res) => {
  try {
    const { role, id: userId, team } = req.user;
    const reports = await getReportsByRole({ role, userId, team });
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

    await validateReport({
      reportId: id,
      status,
      validatedBy: req.user.id
    });

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
