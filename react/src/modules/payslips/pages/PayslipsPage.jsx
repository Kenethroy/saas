import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useEmployees } from "@/modules/employees/hooks/useEmployees";
import { usePayslips } from "@/modules/payslips/hooks/usePayslips";
import { deletePayslip, getPayslipPdf, updatePayslip } from "@/modules/payslips/api/payslips.api";
import { useNotification } from "@/shared/hooks/useNotification";
import { CreatePayslipModal } from "@/modules/payslips/components/CreatePayslipModal";
import { EditPayslipModal } from "@/modules/payslips/components/EditPayslipModal";
import { Pagination } from "@/shared/components/common/Pagination";
import { ConfirmationModal } from "@/shared/components/common/ConfirmationModal";
import { extractBlobErrorMessage, openPdfViewer } from "@/shared/utils/pdf";

function formatMoney(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2
  }).format(Number(value ?? 0));
}

export function PayslipsPage() {
  const notify = useNotification();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editPayslip, setEditPayslip] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);

  const page = Number(searchParams.get("page") || 1);
  const limit = Number(searchParams.get("limit") || 10);
  const employeeId = searchParams.get("employee_id") || "";
  const status = searchParams.get("status") || "";
  const dateFrom = searchParams.get("date_from") || "";
  const dateTo = searchParams.get("date_to") || "";

  const { data: employeesResponse } = useEmployees({ per_page: 200, status: "active" });
  const employees = employeesResponse?.data ?? [];

  const { data, isLoading, isError, error, isFetching } = usePayslips({
    page,
    limit,
    employee_id: employeeId || undefined,
    status: status || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined
  });

  const payslips = data?.data ?? [];
  const meta = data?.meta ?? { page, limit, totalPages: 1, total: payslips.length };

  const selectedEmployeeName = useMemo(() => {
    const employee = employees.find((e) => String(e.id) === String(employeeId));
    if (!employee) return "";
    return `${employee.firstName ?? ""} ${employee.lastName ?? ""}`.trim() || employee.name || "";
  }, [employees, employeeId]);

  const deleteMutation = useMutation({
    mutationFn: deletePayslip,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["payslips"] });
      notify.success("Payslip deleted");
    },
    onError: (err) => notify.error(err?.response?.data?.message || "Failed to delete payslip")
  });

  const releaseMutation = useMutation({
    mutationFn: ({ id, status }) => updatePayslip(id, { status }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["payslips"] });
      notify.success("Payslip status updated");
    },
    onError: (err) => notify.error(err?.response?.data?.message || "Failed to update payslip status")
  });

  const [pdfLoadingId, setPdfLoadingId] = useState(null);

  async function handleOpenPdf(payslip) {
    setPdfLoadingId(payslip.id);
    try {
      const pdfBlob = await getPayslipPdf(payslip.id);
      const normalizedBlob = pdfBlob instanceof Blob ? pdfBlob : new Blob([pdfBlob], { type: "application/pdf" });
      if (!normalizedBlob.size) throw new Error("Payslip PDF is empty.");
      openPdfViewer(navigate, {
        pdfData: normalizedBlob,
        title: "Payslip PDF",
        documentName: `${payslip.payslip_number}.pdf`
      });
    } catch (err) {
      notify.error(await extractBlobErrorMessage(err, "Failed to load payslip PDF."));
    } finally {
      setPdfLoadingId(null);
    }
  }

  function updateQuery(next) {
    const merged = new URLSearchParams(searchParams);
    Object.entries(next).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") merged.delete(key);
      else merged.set(key, String(value));
    });
    setSearchParams(merged, { replace: true });
  }

  function openDeleteConfirm(payslip) {
    setConfirmModal({
      title: "Delete Payslip",
      message: `Are you sure you want to delete payslip ${payslip.payslip_number}? This action cannot be undone.`,
      type: "error",
      confirmText: "Delete",
      onConfirm: () => deleteMutation.mutateAsync(payslip.id)
    });
  }

  function openStatusConfirm(payslip, status) {
    const isRelease = status === "released";
    setConfirmModal({
      title: isRelease ? "Release Payslip" : "Unrelease Payslip",
      message: isRelease 
        ? `Are you sure you want to release payslip ${payslip.payslip_number}? This will generate a business expense record.`
        : `Are you sure you want to revert payslip ${payslip.payslip_number} to draft? This will remove the associated business expense.`,
      type: isRelease ? "success" : "warning",
      confirmText: isRelease ? "Release" : "Unrelease",
      onConfirm: () => releaseMutation.mutateAsync({ id: payslip.id, status })
    });
  }

  function openEditPayslip(payslip) {
    if (String(payslip?.status || "draft") !== "draft") {
      notify.warning("Only draft payslips can be edited.");
      return;
    }
    setEditPayslip(payslip);
  }

  return (
    <div className="space-y-4">
      <section className="erp-page-section">
        <div className="erp-page-header">
          <div className="flex items-center gap-3">
            <i className="fas fa-receipt text-[18px] text-[#90caf9]" />
            <div>
              <div className="erp-page-title">Payslips</div>
              <div className="erp-page-description">Create, manage, and export employee payslips</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="erp-header-secondary-button" onClick={() => navigate("/admin/employees")}>
              Back to Employees
            </button>
            <button type="button" className="erp-header-primary-button" onClick={() => setShowCreateModal(true)}>
              <i className="fas fa-plus mr-1.5" />
              Create Payslip
            </button>
          </div>
        </div>

        <div className="erp-page-filters">
          <div className="erp-filter-label">
            <i className="fas fa-filter mr-1" />
            Filters
          </div>

          <div className="relative min-w-[220px]">
            <select
              className="erp-select"
              value={employeeId}
              onChange={(e) => updateQuery({ employee_id: e.target.value, page: 1 })}
            >
              <option value="">All employees</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {`${employee.firstName ?? ""} ${employee.lastName ?? ""}`.trim() || employee.name || `Employee #${employee.id}`}
                </option>
              ))}
            </select>
          </div>

          <div className="relative min-w-[160px]">
            <select className="erp-select" value={status} onChange={(e) => updateQuery({ status: e.target.value, page: 1 })}>
              <option value="">All status</option>
              <option value="draft">Draft</option>
              <option value="released">Released</option>
            </select>
          </div>

          <div className="relative min-w-[170px]">
            <input
              className="erp-input"
              type="date"
              value={dateFrom}
              onChange={(e) => updateQuery({ date_from: e.target.value, page: 1 })}
              title="Date from"
            />
          </div>

          <div className="relative min-w-[170px]">
            <input
              className="erp-input"
              type="date"
              value={dateTo}
              onChange={(e) => updateQuery({ date_to: e.target.value, page: 1 })}
              title="Date to"
            />
          </div>

          <div className="ml-auto text-[12px] text-[#546e7a]">
            {isFetching ? "Refreshing..." : selectedEmployeeName ? `Employee: ${selectedEmployeeName}` : "All employees"}
          </div>
        </div>
      </section>

      <section className="table-card">
        <div className="erp-table-wrapper">
          <table className="erp-table">
            <thead>
              <tr>
                <th>Payslip No</th>
                <th>Employee</th>
                <th>Pay Date</th>
                <th className="text-right">Gross</th>
                <th className="text-right">Deductions</th>
                <th className="text-right">Net</th>
                <th>Status</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-[12px] text-[#90a4ae]">
                    Loading payslips...
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-[12px] text-[#c62828]">
                    Failed to load payslips{error?.message ? `: ${error.message}` : "."}
                  </td>
                </tr>
              ) : payslips.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-[12px] text-[#90a4ae]">
                    No payslips found.
                  </td>
                </tr>
              ) : (
                payslips.map((payslip) => (
                  <tr key={payslip.id}>
                    <td className="font-mono font-bold text-[#0070b8]">{payslip.payslip_number}</td>
                    <td>{payslip.employee_name || `Employee #${payslip.employee_id}`}</td>
                    <td>{payslip.pay_date}</td>
                    <td className="text-right font-mono">{formatMoney(payslip.gross_pay)}</td>
                    <td className="text-right font-mono">{formatMoney(payslip.total_deductions)}</td>
                    <td className="text-right font-mono font-extrabold">{formatMoney(payslip.net_pay)}</td>
                    <td>
                      <span className={`erp-badge ${payslip.status === "released" ? "erp-badge-success" : "erp-badge-warning"}`}>
                        {String(payslip.status || "draft").toUpperCase()}
                      </span>
                    </td>
                    <td className="text-center">
                      <div className="flex items-center justify-center gap-3">
                        <button
                          type="button"
                          className="erp-btn-link text-[#0070b8] hover:text-[#005a94]"
                          onClick={() => handleOpenPdf(payslip)}
                          disabled={pdfLoadingId === payslip.id}
                          title="View PDF"
                        >
                          <i className={`fas text-[15px] ${pdfLoadingId === payslip.id ? "fa-spinner fa-spin" : "fa-file-pdf"}`} />
                        </button>
                        {payslip.status === "draft" ? (
                          <button
                            type="button"
                            className="erp-btn-link text-[#2e7d32] hover:text-[#1b5e20]"
                            onClick={() => openStatusConfirm(payslip, "released")}
                            disabled={releaseMutation.isPending}
                            title="Release Payslip"
                          >
                            <i className="fas fa-check-circle text-[15px]" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="erp-btn-link text-[#546e7a] hover:text-[#37474f]"
                            onClick={() => openStatusConfirm(payslip, "draft")}
                            disabled={releaseMutation.isPending}
                            title="Unrelease Payslip"
                          >
                            <i className="fas fa-undo text-[15px]" />
                          </button>
                        )}
                        {payslip.status === "draft" ? (
                          <button
                            type="button"
                            className="erp-btn-link text-[#546e7a] hover:text-[#37474f]"
                            onClick={() => openEditPayslip(payslip)}
                            disabled={releaseMutation.isPending}
                            title="Edit"
                          >
                            <i className="fas fa-pen-to-square text-[15px]" />
                          </button>
                        ) : null}
                        <button 
                          type="button" 
                          className="erp-btn-link text-[#c62828] hover:text-[#b71c1c]" 
                          onClick={() => openDeleteConfirm(payslip)} 
                          disabled={deleteMutation.isPending}
                          title="Delete"
                        >
                          <i className="fas fa-trash-alt text-[15px]" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

              {meta.totalPages > 1 ? (
          <div className="border-t bg-white px-4 py-3">
            <Pagination
              currentPage={meta.page}
              lastPage={meta.totalPages}
              perPage={meta.limit}
              total={meta.total}
              loading={isLoading}
              itemLabel="payslips"
              onPrevious={() => updateQuery({ page: Math.max(1, meta.page - 1) })}
              onNext={() => updateQuery({ page: Math.min(meta.totalPages, meta.page + 1) })}
              onGoto={(nextPage) => updateQuery({ page: nextPage })}
            />
          </div>
        ) : null}
      </section>

      <CreatePayslipModal show={showCreateModal} employees={employees} onClose={() => setShowCreateModal(false)} />
      <EditPayslipModal show={Boolean(editPayslip)} payslip={editPayslip} employees={employees} onClose={() => setEditPayslip(null)} />

      <ConfirmationModal
        show={!!confirmModal}
        title={confirmModal?.title}
        message={confirmModal?.message}
        type={confirmModal?.type}
        showCancel={true}
        confirmText={confirmModal?.confirmText}
        onConfirm={confirmModal?.onConfirm}
        onClose={() => setConfirmModal(null)}
      />
    </div>
  );
}
