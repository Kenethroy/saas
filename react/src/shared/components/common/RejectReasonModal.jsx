import { useEffect, useState } from "react";
import { FormModal } from "@/shared/components/common/FormModal";

export function RejectReasonModal({
  show,
  title = "Reject",
  subtitle = "",
  initialReason = "",
  isSubmitting = false,
  onClose,
  onSubmit
}) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!show) return;
    setReason(initialReason ?? "");
  }, [show, initialReason]);

  function handleSubmit() {
    const trimmed = String(reason ?? "").trim();
    if (!trimmed) return;
    onSubmit?.(trimmed);
  }

  const footer = (
    <div className="flex items-center justify-end gap-2">
      <button type="button" className="erp-button-secondary" onClick={onClose} disabled={isSubmitting}>
        Cancel
      </button>
      <button
        type="button"
        className="erp-button-danger"
        onClick={handleSubmit}
        disabled={isSubmitting || !String(reason ?? "").trim()}
      >
        {isSubmitting ? "Rejecting..." : "Reject"}
      </button>
    </div>
  );

  return (
    <FormModal show={show} title={title} size="lg" onClose={onClose} footer={footer}>
      <div className="space-y-3">
        {subtitle ? <div className="text-[12px] text-[#546e7a]">{subtitle}</div> : null}
        <div>
          <label className="erp-label">Reject reason</label>
          <textarea
            className="erp-textarea h-28"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Type the reason for rejection..."
            disabled={isSubmitting}
            maxLength={255}
          />
          <div className="mt-1 text-right text-[10px] text-[#90a4ae]">{String(reason ?? "").length}/255</div>
        </div>
      </div>
    </FormModal>
  );
}

