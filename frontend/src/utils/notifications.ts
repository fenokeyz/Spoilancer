import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { getTemplates, WEEKDAYS_SHORT, ExpenseField, logExpense } from "@/src/store/finance";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export const LOG_CATEGORY = "spoilancer_log_expense";
export const LOG_ACTION = "log_expense_reply";

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

// Register an interactive category with an inline text-input "Log" action so users
// can log a spend straight from the reminder without opening the app.
export async function registerNotificationCategories(): Promise<void> {
  try {
    await Notifications.setNotificationCategoryAsync(LOG_CATEGORY, [
      {
        identifier: LOG_ACTION,
        buttonTitle: "Log spend",
        textInput: {
          placeholder: "Amount spent, e.g. 180",
          submitButtonTitle: "Log",
        },
        options: { opensAppToForeground: false },
      },
    ]);
  } catch (e) {
    console.warn("registerNotificationCategories failed", e);
  }
}

// our weekday index 0=Mon..6=Sun -> expo weekday 1=Sun..7=Sat
function expoWeekday(idx: number): number {
  const jsDay = (idx + 1) % 7; // 0=Sun..6=Sat
  return jsDay + 1;
}

export async function rescheduleReminders(): Promise<void> {
  try {
    await registerNotificationCategories();
    await Notifications.cancelAllScheduledNotificationsAsync();
    const templates = await getTemplates();

    for (const f of templates) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `How much on ${f.title}?`,
          body: `Reply here to log your ${WEEKDAYS_SHORT[f.weekday]} ${f.title} spend before it locks you out.`,
          data: { type: "field", fieldId: f.id },
          categoryIdentifier: LOG_CATEGORY,
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

// Handle a notification response — used by NotificationResponder.
// Returns "logged" if a spend was logged inline, "open" if the app should route home, else null.
export async function handleNotificationResponse(
  response: Notifications.NotificationResponse,
): Promise<"logged" | "open" | null> {
  try {
    const data: any = response.notification.request.content.data || {};
    if (response.actionIdentifier === LOG_ACTION) {
      const text = (response as any).userText as string | undefined;
      const match = text ? text.replace(/,/g, "").match(/[0-9]+(\.[0-9]+)?/) : null;
      const amount = match ? parseFloat(match[0]) : NaN;
      if (data.type === "field" && data.fieldId && !isNaN(amount)) {
        const templates = await getTemplates();
        const field = templates.find((t: ExpenseField) => t.id === data.fieldId);
        if (field) {
          await logExpense(field, amount, "sms");
          // Clear the notification so its inline-reply spinner doesn't hang.
          try {
            await Notifications.dismissNotificationAsync(response.notification.request.identifier);
          } catch {}
          return "logged";
        }
      }
      try {
        await Notifications.dismissNotificationAsync(response.notification.request.identifier);
      } catch {}
      return null;
    }
    // default tap
    return "open";
  } catch (e) {
    console.warn("handleNotificationResponse failed", e);
    return null;
  }
}
