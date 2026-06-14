import cron from "node-cron";
import { processAllShops } from "./call-processor.server";

export function startCronJobs() {
  // Process abandoned checkouts every 5 minutes
  cron.schedule("*/5 * * * *", async () => {
    console.log(`[CRON] ${new Date().toISOString()} - Processing abandoned checkouts...`);
    try {
      const results = await processAllShops();
      const totalCalls = results.reduce((sum, r) => sum + r.callsInitiated, 0);
      if (totalCalls > 0) {
        console.log(`[CRON] Completed: ${totalCalls} call(s) initiated across ${results.length} shop(s)`);
      }
    } catch (error) {
      console.error("[CRON] Error processing abandoned checkouts:", error);
    }
  });

  console.log("[CRON] Abandoned checkout processor started (every 5 minutes)");
}
