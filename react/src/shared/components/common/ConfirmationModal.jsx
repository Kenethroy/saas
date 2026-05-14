import { createPortal } from "react-dom";

const typeConfig = {
  success: {
    iconBg: "bg-[#e8f5e9]",
    icon: "fas fa-check-circle text-[#2e7d32]",
    button: "bg-[#2e7d32] hover:bg-[#1b5e20]"
  },
  warning: {
    iconBg: "bg-[#fff8e1]",
    icon: "fas fa-exclamation-triangle text-[#f9a825]",
    button: "bg-[#f9a825] hover:bg-[#f57f17]"
  },
  error: {
    iconBg: "bg-[#fce4e4]",
    icon: "fas fa-exclamation-circle text-[#c62828]",
    button: "bg-[#c62828] hover:bg-[#b71c1c]"
  },
  info: {
    iconBg: "bg-[#e8f1f8]",
    icon: "fas fa-info-circle text-[#0070b8]",
    button: "bg-[#0070b8] hover:bg-[#005a94]"
  }
};

export function ConfirmationModal({
  show,
  title,
  message,
  type = "info",
  showCancel = false,
  confirmText = "OK",
  cancelText = "Cancel",
  onConfirm,
  onClose
}) {
  if (!show) {
    return null;
  }

  const config = typeConfig[type] ?? typeConfig.info;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/20 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md border border-[#b0bec5] bg-white shadow-[0_8px_32px_rgba(0,0,0,0.18)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="px-[18px] py-[16px]">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-sm ${config.iconBg}`}>
              <i className={`${config.icon} text-[16px]`} />
            </div>
            <div className="flex-1">
              <p className="mb-1 text-[13px] font-bold text-[#1a3557]">{title}</p>
              {typeof message === "string" ? (
                <p className="text-[12px] leading-relaxed text-[#212121]">{message}</p>
              ) : (
                <div className="text-[12px] leading-relaxed text-[#212121]">{message}</div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-[18px] pb-[16px]">
          {showCancel ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-sm border border-[#b0bec5] bg-white px-[14px] py-[7px] text-[12px] font-bold text-[#546e7a] transition-colors hover:bg-[#f3f6f9]"
            >
              {cancelText}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              onConfirm?.();
              onClose?.();
            }}
            className={`rounded-sm px-[15px] py-[7px] text-[12px] font-bold text-white transition-colors ${config.button}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
