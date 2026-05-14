import { FormModal } from "@/shared/components/common/FormModal";

const helperToneClasses = {
  info: "border-[#cfe0ec] bg-[#f6fbff] text-[#315775]",
  warning: "border-[#ffe082] bg-[#fff8e1] text-[#8d6e00]",
  error: "border-[#ef9a9a] bg-[#fff5f5] text-[#b71c1c]",
  success: "border-[#a5d6a7] bg-[#e8f5e9] text-[#2e7d32]"
};

export function StatusUpdateModal({
  show,
  title,
  referenceLabel = "Record",
  referenceValue,
  currentStatus,
  currentStatusLabel,
  selectedStatus,
  selectedStatusLabel,
  options,
  getStatusClassName,
  helperText,
  helperTone = "info",
  confirmText = "Update Status",
  isSubmitting = false,
  disableSubmit = false,
  onSelectStatus,
  onClose,
  onConfirm
}) {
  const currentClassName = getStatusClassName?.(currentStatus) ?? "border-[#b0bec5] bg-[#f3f6f9] text-[#607d8b]";
  const nextClassName = getStatusClassName?.(selectedStatus) ?? "border-[#b0bec5] bg-[#f3f6f9] text-[#607d8b]";
  const helperClassName = helperToneClasses[helperTone] ?? helperToneClasses.info;

  return (
    <FormModal show={show} title={title} size="md" closeOnClickOutside={!isSubmitting} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm?.();
        }}
        className="space-y-4"
      >
        <section className="rounded-sm border border-[#d3dee7] bg-white p-4">
          <div className="grid gap-4">
            <div>
              <div className="erp-label">{referenceLabel}</div>
              <div className="font-mono text-[13px] font-bold text-[#1a3557]">{referenceValue}</div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-sm border border-[#e3ebf1] bg-[#fbfdff] p-3">
                <div className="erp-label">Current Status</div>
                <span className={`erp-chip ${currentClassName}`}>{currentStatusLabel}</span>
              </div>

              <div className="rounded-sm border border-[#e3ebf1] bg-[#fbfdff] p-3">
                <div className="erp-label">Next Status Preview</div>
                <span className={`erp-chip ${nextClassName}`}>{selectedStatusLabel}</span>
              </div>
            </div>

            <div>
              <label className="erp-label">Next Status</label>
              <select
                value={selectedStatus}
                onChange={(event) => onSelectStatus?.(event.target.value)}
                className="erp-select"
                disabled={isSubmitting}
              >
                {options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {helperText ? (
              <div className={`rounded-sm border px-3 py-2 text-[11px] leading-relaxed ${helperClassName}`}>
                {helperText}
              </div>
            ) : null}
          </div>
        </section>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="erp-button-secondary" disabled={isSubmitting}>
            Cancel
          </button>
          <button type="submit" className="erp-button-primary" disabled={disableSubmit || isSubmitting}>
            {isSubmitting ? "Saving..." : confirmText}
          </button>
        </div>
      </form>
    </FormModal>
  );
}
