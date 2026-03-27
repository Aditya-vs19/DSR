import cron from "node-cron";
import { generateDailyReports } from "../models/reportModel.js";
import { carryForwardPendingTasks } from "../models/taskModel.js";

export const startCronJobs = () => {
  cron.schedule("5 0 * * *", async () => {
    const today = new Date().toISOString().slice(0, 10);

    try {
      const result = await carryForwardPendingTasks(today);
      console.log(
        `[CRON] Carried forward ${result.createdCount} pending/in-progress task(s) from ${result.sourceDate} to ${result.targetDate}`
      );
    } catch (error) {
      console.error("[CRON] Pending/In Progress task carry-forward failed:", error.message);
    }
  });

  cron.schedule("30 18 * * *", async () => {
    const today = new Date().toISOString().slice(0, 10);
    try {
      await generateDailyReports(today);
      console.log(`[CRON] Daily reports generated for ${today}`);
    } catch (error) {
      console.error("[CRON] Daily report generation failed:", error.message);
    }
  });
};
