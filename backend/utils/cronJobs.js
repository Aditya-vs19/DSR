import cron from "node-cron";
import { generateDailyReports } from "../models/reportModel.js";
import { carryForwardPendingTasks } from "../models/taskModel.js";
import { sendAutomatedReportEmail } from "./reportMailer.js";

const REPORT_TIMEZONE = process.env.REPORT_TIMEZONE || "Asia/Kolkata";

const getReportDateText = () => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: REPORT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  return formatter.format(new Date());
};

const parseDateText = (dateText) => {
  const [year, month, day] = String(dateText || "").split("-").map(Number);
  return new Date(year, month - 1, day);
};

const formatDateText = (value) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getPreviousDateText = (dateText) => {
  const previous = parseDateText(dateText);
  previous.setDate(previous.getDate() - 1);
  return formatDateText(previous);
};

const getWeeklyRange = (dateText) => {
  const current = parseDateText(dateText);
  const day = current.getDay();
  const diffToMonday = (day + 6) % 7;
  const start = new Date(current);
  start.setDate(current.getDate() - diffToMonday);

  return {
    startDate: formatDateText(start),
    endDate: formatDateText(current)
  };
};

const getPreviousMonthRange = (dateText) => {
  const current = parseDateText(dateText);
  const start = new Date(current.getFullYear(), current.getMonth() - 1, 1);
  const end = new Date(current.getFullYear(), current.getMonth(), 0);

  return {
    startDate: formatDateText(start),
    endDate: formatDateText(end)
  };
};

export const startCronJobs = () => {
  cron.schedule("5 0 * * *", async () => {
    const today = getReportDateText();

    try {
      const result = await carryForwardPendingTasks(today);
      console.log(
        `[CRON] Carried forward ${result.createdCount} pending/in-progress task(s) from ${result.sourceDate} to ${result.targetDate}`
      );
    } catch (error) {
      console.error("[CRON] Pending/In Progress task carry-forward failed:", error.message);
    }
  }, { timezone: REPORT_TIMEZONE });

  cron.schedule("0 9 * * *", async () => {
    const today = getReportDateText();
    const reportDate = getPreviousDateText(today);

    try {
      await generateDailyReports(reportDate);
      console.log(`[CRON] Daily reports generated for ${reportDate}`);

      const emailResult = await sendAutomatedReportEmail({
        reportType: "Daily",
        startDate: reportDate,
        endDate: reportDate,
        ensureDailyReport: false
      });
      console.log("[CRON] Daily report email status:", emailResult);
    } catch (error) {
      console.error("[CRON] Daily report generation/email failed:", error.message);
    }
  }, { timezone: REPORT_TIMEZONE });

  cron.schedule("30 18 * * 6", async () => {
    const today = getReportDateText();
    const { startDate, endDate } = getWeeklyRange(today);

    try {
      const emailResult = await sendAutomatedReportEmail({
        reportType: "Weekly",
        startDate,
        endDate
      });
      console.log("[CRON] Weekly report email status:", emailResult);
    } catch (error) {
      console.error("[CRON] Weekly report email failed:", error.message);
    }
  }, { timezone: REPORT_TIMEZONE });

  cron.schedule("30 18 5 * *", async () => {
    const today = getReportDateText();
    const { startDate, endDate } = getPreviousMonthRange(today);

    try {
      const emailResult = await sendAutomatedReportEmail({
        reportType: "Monthly",
        startDate,
        endDate
      });
      console.log("[CRON] Monthly report email status:", emailResult);
    } catch (error) {
      console.error("[CRON] Monthly report email failed:", error.message);
    }
  }, { timezone: REPORT_TIMEZONE });
};
