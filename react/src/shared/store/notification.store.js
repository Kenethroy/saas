import { create } from "zustand";

let nextNotificationId = 0;

function createNotification(type, message, options = {}) {
  return {
    id: ++nextNotificationId,
    type,
    message,
    title: options.title ?? null,
    duration: options.duration ?? (type === "error" ? 6000 : 4000),
    action: options.action ?? null,
    progress: 100
  };
}

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  timers: {},
  progressTimers: {},

  add(notification) {
    set((state) => ({
      notifications: [...state.notifications, notification]
    }));

    if (notification.duration > 0) {
      const progressTimer = window.setTimeout(() => {
        set((state) => ({
          notifications: state.notifications.map((item) =>
            item.id === notification.id
              ? { ...item, progress: 0 }
              : item
          )
        }));
      }, 50);

      const dismissTimer = window.setTimeout(() => {
        get().dismiss(notification.id);
      }, notification.duration + 100);

      set((state) => ({
        timers: {
          ...state.timers,
          [notification.id]: dismissTimer
        },
        progressTimers: {
          ...state.progressTimers,
          [notification.id]: progressTimer
        }
      }));
    }

    return notification.id;
  },

  dismiss(id) {
    const { timers, progressTimers } = get();

    if (timers[id]) {
      window.clearTimeout(timers[id]);
    }

    if (progressTimers[id]) {
      window.clearTimeout(progressTimers[id]);
    }

    set((state) => {
      const nextTimers = { ...state.timers };
      const nextProgressTimers = { ...state.progressTimers };
      delete nextTimers[id];
      delete nextProgressTimers[id];

      return {
        notifications: state.notifications.filter((item) => item.id !== id),
        timers: nextTimers,
        progressTimers: nextProgressTimers
      };
    });
  },

  dismissAll() {
    const { timers, progressTimers } = get();

    Object.values(timers).forEach((timer) => window.clearTimeout(timer));
    Object.values(progressTimers).forEach((timer) => window.clearTimeout(timer));

    set({
      notifications: [],
      timers: {},
      progressTimers: {}
    });
  },

  success(message, options = {}) {
    return get().add(createNotification("success", message, options));
  },

  error(message, options = {}) {
    return get().add(createNotification("error", message, options));
  },

  warning(message, options = {}) {
    return get().add(createNotification("warning", message, options));
  },

  info(message, options = {}) {
    return get().add(createNotification("info", message, options));
  }
}));
