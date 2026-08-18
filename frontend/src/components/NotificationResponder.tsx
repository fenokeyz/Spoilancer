import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";

import { useToast } from "@/src/components/Toast";
import {
  handleNotificationResponse,
  registerNotificationCategories,
} from "@/src/utils/notifications";

// Mounts once at the app root. Handles inline "Log spend" replies from reminders
// and taps on notifications (routes into the app / gate).
export function NotificationResponder() {
  const router = useRouter();
  const toast = useToast();
  const handledColdStart = useRef(false);

  useEffect(() => {
    registerNotificationCategories();

    async function act(response: Notifications.NotificationResponse | null) {
      if (!response) return;
      const result = await handleNotificationResponse(response);
      if (result === "logged") {
        // Inline reply handled in the background — just confirm, don't force-navigate.
        toast.show("Logged from your reminder ✦", "success");
      } else if (result === "open") {
        router.replace("/");
      }
    }

    // Cold start (app opened by tapping a notification)
    (async () => {
      if (handledColdStart.current) return;
      handledColdStart.current = true;
      try {
        const last = await Notifications.getLastNotificationResponseAsync();
        await act(last);
      } catch {}
    })();

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      act(response);
    });
    return () => sub.remove();
  }, []);

  return null;
}
