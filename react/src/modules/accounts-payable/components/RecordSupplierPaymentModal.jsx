import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FormModal } from "@/shared/components/common/FormModal";
import { useNotification } from "@/shared/hooks/useNotification";
import { recordSupplierPayment } from "@/modules/accounts-payable/api/accounts-payable.api";

const paymentMethodOptions = [
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "credit_card", label: "Credit Card" },
  { value: "other", label: "Other" }
];

function formatMoney(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2
  }).format(Number(value ?? 0));
}

function formatDateInput(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createDefaultForm(record) {
  return {
    paymentDate: formatDateInput(new Date()),
    amount: record?.outstandingAmount ? String(record.outstandingAmount) : "",
    paymentMethod: "cash",
    referenceNumber: "",
    notes: "",
    proofFile: null
  };
}

function extractErrorMessage(error, fallbackMessage) {
  return error?.response?.data?.message
    || error?.response?.data?.error
    || error?.message
    || fallbackMessage;
}

export function RecordSupplierPaymentModal({ show, record, onClose, onSuccess }) {
  const notify = useNotification();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() => createDefaultForm(record));

  useEffect(() => {
    if (!show) {
      return;
    }

    setForm(createDefaultForm(record));
  }, [show, record]);

  const mutation = useMutation({
    mutationFn: recordSupplierPayment,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["accounts-payable"] }),
        queryClient.invalidateQueries({ queryKey: ["supplier-detail"] }),
        queryClient.invalidateQueries({ queryKey: ["supplier-payables"] })
      ]);
      notify.success("Supplier payment recorded successfully");
      onSuccess?.();
      onClose?.();
    },
    onError: (error) => {
      notify.error(extractErrorMessage(error, "Failed to record supplier payment."));
    }
  });

  function updateField(key, value) {
    setForm((current) => ({
      ...current,
      [key]: value
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const amount = Number(form.amount);

    if (!record?.id || !record?.supplierId) {
      notify.warning("Invalid payable record selected.");
      return;
    }

    if (!form.paymentDate) {
      notify.warning("Payment date is required.");
      return;
    }

    if (!amount || amount <= 0) {
      notify.warning("Enter a valid payment amount.");
      return;
    }

    if (amount > Number(record.outstandingAmount ?? 0)) {
      notify.warning("Payment amount cannot exceed the outstanding balance.");
      return;
    }

    if (!form.paymentMethod) {
      notify.warning("Payment method is required.");
      return;
    }

    const formData = new FormData();
    formData.append("supplier_id", String(record.supplierId));
    formData.append("accounts_payable_id", String(record.id));
    formData.append("date", form.paymentDate);
    formData.append("amount", String(amount));
    formData.append("payment_method", form.paymentMethod);

    if (form.referenceNumber) {
      formData.append("reference_number", form.referenceNumber);
    }

    if (form.notes) {
      formData.append("notes", form.notes);
    }

    if (form.proofFile) {
      formData.append("proof_image", form.proofFile);
    }

    await mutation.mutateAsync(formData);
  }

  return (
    <FormModal show={show} title="Record Supplier Payment" size="xl" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex items-center justify-between rounded-sm border border-[#2c5f8a] bg-[#0070b8] px-4 py-3 text-white">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.5px] text-[#90caf9]">Outstanding Balance</div>
            <div className="mt-1 font-mono text-[22px] font-extrabold">{formatMoney(record?.outstandingAmount)}</div>
          </div>
          <div className="text-right text-[11px] text-[#d9edf9]">
            <div className="font-bold">{record?.supplierName ?? "Supplier"}</div>
            <div>{record?.poNumber ?? "Payable record"}</div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="erp-label">Supplier</label>
            <input value={record?.supplierName ?? ""} readOnly className="erp-input bg-[#eef5fa]" />
          </div>
          <div>
            <label className="erp-label">PO Number</label>
            <input value={record?.poNumber ?? ""} readOnly className="erp-input bg-[#eef5fa]" />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="erp-label">Payment Date</label>
            <input
              type="date"
              value={form.paymentDate}
              onChange={(event) => updateField("paymentDate", event.target.value)}
              className="erp-input"
            />
          </div>
          <div>
            <label className="erp-label">Amount</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] font-bold text-[#546e7a]">₱</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(event) => updateField("amount", event.target.value)}
                className="erp-input pl-7"
                placeholder="0.00"
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="erp-label">Payment Method</label>
            <select
              value={form.paymentMethod}
              onChange={(event) => updateField("paymentMethod", event.target.value)}
              className="erp-select"
            >
              {paymentMethodOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="erp-label">Reference Number</label>
            <input
              value={form.referenceNumber}
              onChange={(event) => updateField("referenceNumber", event.target.value)}
              className="erp-input"
              placeholder="Cheque no. / transfer ref."
            />
          </div>
        </div>

        <div>
          <label className="erp-label">Proof Image</label>
          <input
            type="file"
            accept="image/*"
            onChange={(event) => updateField("proofFile", event.target.files?.[0] ?? null)}
            className="erp-input file:mr-3 file:rounded-sm file:border-0 file:bg-[#0070b8] file:px-3 file:py-2 file:text-[11px] file:font-bold file:text-white"
          />
        </div>

        <div>
          <label className="erp-label">Notes</label>
          <textarea
            value={form.notes}
            onChange={(event) => updateField("notes", event.target.value)}
            className="erp-input min-h-[92px]"
            placeholder="Optional payment notes..."
          />
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#dce5ec] pt-4">
          <button type="button" onClick={onClose} className="erp-header-secondary-button">
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-sm bg-[#2e7d32] px-3.5 py-1.5 text-[12px] font-bold text-white transition-colors hover:bg-[#1b5e20] disabled:cursor-not-allowed disabled:bg-[#b0bec5]"
            disabled={mutation.isPending}
          >
            <i className={`fas ${mutation.isPending ? "fa-spinner animate-spin" : "fa-check"}`} />
            {mutation.isPending ? "Recording..." : "Record Payment"}
          </button>
        </div>
      </form>
    </FormModal>
  );
}
