import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FormModal } from "@/shared/components/common/FormModal";
import { useNotification } from "@/shared/hooks/useNotification";
import { createPayslip } from "@/modules/payslips/api/payslips.api";

function formatDateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function CreatePayslipModal({ show, employees = [], onClose }) {
  const notify = useNotification();
  const queryClient = useQueryClient();
  const defaultEmployeeId = employees?.[0]?.id ? String(employees[0].id) : "";

  const [form, setForm] = useState(() => ({
    employeeId: defaultEmployeeId,
    periodStart: formatDateInput(new Date()),
    periodEnd: formatDateInput(new Date()),
    payDate: formatDateInput(new Date()),
    basicPay: "",
    overtimePay: "",
    allowances: "",
    deductions: "",
    notes: "",
    status: "draft"
  }));

  const selectedEmployeeName = useMemo(() => {
    const employee = employees.find((e) => String(e.id) === String(form.employeeId));
    if (!employee) return "";
    return `${employee.firstName ?? ""} ${employee.lastName ?? ""}`.trim() || employee.name || "";
  }, [employees, form.employeeId]);

  const mutation = useMutation({
    mutationFn: createPayslip,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["payslips"] });
      notify.success("Payslip created successfully");
      onClose?.();
    },
    onError: (error) => {
      notify.error(error?.response?.data?.message || "Failed to create payslip");
    }
  });

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit() {
    if (!form.employeeId) return notify.warning("Employee is required");
    if (!form.periodStart || !form.periodEnd) return notify.warning("Pay period is required");
    if (!form.payDate) return notify.warning("Pay date is required");

    const payload = {
      employee_id: Number(form.employeeId),
      period_start: form.periodStart,
      period_end: form.periodEnd,
      pay_date: form.payDate,
      basic_pay: Number(form.basicPay || 0),
      overtime_pay: Number(form.overtimePay || 0),
      allowances: Number(form.allowances || 0),
      deductions: Number(form.deductions || 0),
      notes: form.notes || null,
      status: form.status
    };

    await mutation.mutateAsync(payload);
  }

  const footer = (
    <div className="flex items-center justify-end gap-2">
      <button type="button" className="erp-button-secondary" onClick={onClose} disabled={mutation.isPending}>
        Cancel
      </button>
      <button type="button" className="erp-button-primary" onClick={handleSubmit} disabled={mutation.isPending}>
        {mutation.isPending ? "Saving..." : "Create Payslip"}
      </button>
    </div>
  );

  return (
    <FormModal show={show} title="Create Payslip" size="2xl" onClose={onClose} footer={footer}>
      <div className="space-y-4">
        <div className="rounded-sm border border-[#dde3e8] bg-white px-4 py-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#546e7a]">Employee</div>
          <div className="mt-1 text-[13px] font-bold text-[#1a3557]">{selectedEmployeeName || "Select employee"}</div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="erp-label">Employee</label>
            <select className="erp-select" value={form.employeeId} onChange={(e) => updateField("employeeId", e.target.value)}>
              <option value="">Select employee</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {`${employee.firstName ?? ""} ${employee.lastName ?? ""}`.trim() || employee.name || `Employee #${employee.id}`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="erp-label">Status</label>
            <select className="erp-select" value={form.status} onChange={(e) => updateField("status", e.target.value)}>
              <option value="draft">Draft</option>
              <option value="released">Released</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="erp-label">Period Start</label>
            <input className="erp-input" type="date" value={form.periodStart} onChange={(e) => updateField("periodStart", e.target.value)} />
          </div>
          <div>
            <label className="erp-label">Period End</label>
            <input className="erp-input" type="date" value={form.periodEnd} onChange={(e) => updateField("periodEnd", e.target.value)} />
          </div>
          <div>
            <label className="erp-label">Pay Date</label>
            <input className="erp-input" type="date" value={form.payDate} onChange={(e) => updateField("payDate", e.target.value)} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label className="erp-label">Basic Pay</label>
            <input className="erp-input" type="number" step="0.01" value={form.basicPay} onChange={(e) => updateField("basicPay", e.target.value)} placeholder="0.00" />
          </div>
          <div>
            <label className="erp-label">Overtime Pay</label>
            <input className="erp-input" type="number" step="0.01" value={form.overtimePay} onChange={(e) => updateField("overtimePay", e.target.value)} placeholder="0.00" />
          </div>
          <div>
            <label className="erp-label">Allowances</label>
            <input className="erp-input" type="number" step="0.01" value={form.allowances} onChange={(e) => updateField("allowances", e.target.value)} placeholder="0.00" />
          </div>
          <div>
            <label className="erp-label">Deductions</label>
            <input className="erp-input" type="number" step="0.01" value={form.deductions} onChange={(e) => updateField("deductions", e.target.value)} placeholder="0.00" />
          </div>
        </div>

        <div>
          <label className="erp-label">Notes (optional)</label>
          <textarea className="erp-textarea h-24" value={form.notes} onChange={(e) => updateField("notes", e.target.value)} placeholder="Add remarks or notes..." />
        </div>
      </div>
    </FormModal>
  );
}
