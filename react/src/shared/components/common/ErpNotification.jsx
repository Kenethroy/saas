import { createPortal } from "react-dom";
import { useNotificationStore } from "@/shared/store/notification.store";

const typeLabels = {
  success: "Success",
  error: "Error",
  warning: "Warning",
  info: "Information"
};

const typeStyles = {
  success: {
    container: "bg-white border-[#2e7d32]",
    header: "bg-[#e8f5e9] border-[#c8e6c9]",
    icon: "fas fa-check-circle text-[#2e7d32]",
    titleText: "text-[#1b5e20]",
    messageText: "text-[#2e7d32]",
    closeBtn: "text-[#2e7d32] hover:bg-[#c8e6c9]",
    actionBtn: "text-[#2e7d32]",
    progressTrack: "bg-[#c8e6c9]",
    progressBar: "bg-[#2e7d32]"
  },
  error: {
    container: "bg-white border-[#c62828]",
    header: "bg-[#fce4e4] border-[#ef9a9a]",
    icon: "fas fa-exclamation-circle text-[#c62828]",
    titleText: "text-[#b71c1c]",
    messageText: "text-[#c62828]",
    closeBtn: "text-[#c62828] hover:bg-[#ef9a9a]",
    actionBtn: "text-[#c62828]",
    progressTrack: "bg-[#ef9a9a]",
    progressBar: "bg-[#c62828]"
  },
  warning: {
    container: "bg-white border-[#f57f17]",
    header: "bg-[#fff8e1] border-[#ffcc80]",
    icon: "fas fa-exclamation-triangle text-[#f57f17]",
    titleText: "text-[#e65100]",
    messageText: "text-[#f57f17]",
    closeBtn: "text-[#f57f17] hover:bg-[#ffcc80]",
    actionBtn: "text-[#f57f17]",
    progressTrack: "bg-[#ffcc80]",
    progressBar: "bg-[#f57f17]"
  },
  info: {
    container: "bg-white border-[#0070b8]",
    header: "bg-[#e8f1f8] border-[#90caf9]",
    icon: "fas fa-info-circle text-[#0070b8]",
    titleText: "text-[#1a3557]",
    messageText: "text-[#0070b8]",
    closeBtn: "text-[#0070b8] hover:bg-[#90caf9]",
    actionBtn: "text-[#0070b8]",
    progressTrack: "bg-[#b3d4f0]",
    progressBar: "bg-[#0070b8]"
  }
};

export function ErpNotification() {
  const notifications = useNotificationStore((state) => state.notifications);
  const dismiss = useNotificationStore((state) => state.dismiss);

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="pointer-events-none fixed right-4 top-4 z-[9999] flex w-full max-w-[400px] flex-col gap-2">
      {notifications.map((notification) => {
        const styles = typeStyles[notification.type];

        return (
          <div
            key={notification.id}
            role="alert"
            className={`pointer-events-auto overflow-hidden border-l-4 shadow-xl ${styles.container}`}
          >
            <div className={`flex items-center justify-between border-b px-3 py-2 ${styles.header}`}>
              <div className="flex items-center gap-2">
                <i className={`${styles.icon} text-[13px]`} />
                <span className={`text-[11px] font-bold uppercase tracking-[0.6px] ${styles.titleText}`}>
                  {notification.title || typeLabels[notification.type]}
                </span>
              </div>
              <button
                type="button"
                onClick={() => dismiss(notification.id)}
                className={`inline-flex h-5 w-5 items-center justify-center rounded-sm opacity-60 transition-opacity hover:opacity-100 ${styles.closeBtn}`}
              >
                <i className="fas fa-times text-[10px]" />
              </button>
            </div>

            <div className="bg-white px-3 py-2.5">
              <p className={`text-[12px] leading-relaxed ${styles.messageText}`}>
                {notification.message}
              </p>
            </div>

            {notification.action ? (
              <div className="flex justify-end bg-white px-3 pb-2.5">
                <button
                  type="button"
                  onClick={() => {
                    notification.action.handler?.();
                    dismiss(notification.id);
                  }}
                  className={`text-[11px] font-bold underline underline-offset-2 transition-all hover:no-underline ${styles.actionBtn}`}
                >
                  {notification.action.label}
                </button>
              </div>
            ) : null}

            <div className={`h-[3px] w-full ${styles.progressTrack}`}>
              <div
                className={`h-full ${styles.progressBar}`}
                style={{
                  width: `${notification.progress}%`,
                  transition: `width ${notification.duration}ms linear`
                }}
              />
            </div>
          </div>
        );
      })}
    </div>,
    document.body
  );
}
