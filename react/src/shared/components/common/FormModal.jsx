import { createPortal } from "react-dom";

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl"
};

export function FormModal({
  show,
  title,
  size = "lg",
  closeOnClickOutside = false,
  hideHeader = false,
  onClose,
  children,
  footer = null,
  footerClassName = "bg-white",
  panelClassName = "",
  bodyClassName = "bg-[#f7fbfe] p-6"
}) {
  if (!show) {
    return null;
  }

  const modal = (
    <div
      className="fixed inset-0 z-[70] bg-black/50"
      onClick={closeOnClickOutside ? onClose : undefined}
    >
      <div className="flex h-full w-full items-center justify-center p-4">
        <div
          className={`hide-scrollbar flex max-h-[90vh] w-full flex-col overflow-y-auto bg-[#fbfdff] shadow-lg ${sizeClasses[size] ?? size ?? sizeClasses.lg} ${panelClassName}`}
          onClick={(event) => event.stopPropagation()}
        >
          {!hideHeader ? (
            <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b bg-[#0070b8] px-6 py-4">
              <h3 className="text-[14px] font-bold text-white">{title}</h3>
              <button type="button" onClick={onClose} className="text-white transition hover:text-gray-200">
                <i className="fas fa-times" aria-hidden="true" />
              </button>
            </div>
          ) : null}

          <div className={bodyClassName}>{children}</div>

          {footer ? <div className={`shrink-0 border-t px-6 py-4 ${footerClassName}`}>{footer}</div> : null}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
