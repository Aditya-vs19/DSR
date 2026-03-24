import cron from "node-cron";
import { generateDailyReports } from "../models/reportModel.js";

export const startCronJobs = () => {
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
