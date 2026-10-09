import { dispatchDueDateReminderNotificationsInternal } from '@/lib/notifications-core';

async function main() {
  const result = await dispatchDueDateReminderNotificationsInternal();
  console.log(`Dispatched ${result.notifications} due-date reminder batch(es).`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

