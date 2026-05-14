import { useNotificationStore } from "@/shared/store/notification.store";

export function useNotification() {
  const add = useNotificationStore((state) => state.add);
  const dismiss = useNotificationStore((state) => state.dismiss);
  const dismissAll = useNotificationStore((state) => state.dismissAll);
  const success = useNotificationStore((state) => state.success);
  const error = useNotificationStore((state) => state.error);
  const warning = useNotificationStore((state) => state.warning);
  const info = useNotificationStore((state) => state.info);

  return {
    add,
    dismiss,
    dismissAll,
    success,
    error,
    warning,
    info
  };
}
