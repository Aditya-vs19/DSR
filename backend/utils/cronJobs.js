import cron from "node-cron";
import { generateDailyReports } from "../models/reportModel.js";
import { carryForwardPendingTasks } from "../models/taskModel.js";

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

  cron.schedule("30 18 * * *", async () => {
    const today = getReportDateText();
    try {
      await generateDailyReports(today);
      console.log(`[CRON] Daily reports generated for ${today}`);
    } catch (error) {
      console.error("[CRON] Daily report generation failed:", error.message);
    }
  }, { timezone: REPORT_TIMEZONE });
};
