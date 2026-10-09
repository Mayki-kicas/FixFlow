import { processPendingNotificationEmailJobs } from '@/lib/notifications-core';

async function main() {
  const limit = Number(process.env.LIMIT || 100);
  const result = await processPendingNotificationEmailJobs(Number.isFinite(limit) ? limit : 100);
  console.log(`Processed ${result.processed} notification email job(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

