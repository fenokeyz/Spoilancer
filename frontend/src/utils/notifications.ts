import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { getTemplates, WEEKDAYS_SHORT } from "@/src/store/finance";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    const settings = await Notifications.getPermissionsAsync();
    if (settings.granted) return true;
    if (!settings.canAskAgain) return false;
    const req = await Notifications.requestPermissionsAsync();
    return req.granted;
  } catch {
    return false;
  }
}

// our weekday index 0=Mon..6=Sun -> expo weekday 1=Sun..7=Sat
function expoWeekday(idx: number): number {
  const jsDay = (idx + 1) % 7; // 0=Sun..6=Sat
  return jsDay + 1;
}

export async function rescheduleReminders(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    const templates = await getTemplates();

    for (const f of templates) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `How much did you spend on ${f.title}?`,
          body: `Tap to log your ${WEEKDAYS_SHORT[f.weekday]} ${f.title} spend before it locks you out.`,
          data: { type: "field", fieldId: f.id },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: expoWeekday(f.weekday),
          hour: f.hour,
          minute: f.minute,
        },
      });
    }

    // Nightly catch-up reminder at 23:00
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Don't lose your Spoilance ✦",
        body: "You have unlogged expenses today. Open Spoilancer to fill them in.",
        data: { type: "catchup" },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 23,
        minute: 0,
      },
    });
  } catch (e) {
    console.warn("rescheduleReminders failed", e);
  }
}
