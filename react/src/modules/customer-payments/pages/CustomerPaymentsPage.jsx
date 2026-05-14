import { useEffect, useState, useDeferredValue } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormModal } from "@/shared/components/common/FormModal";
import { Pagination } from "@/shared/components/common/Pagination";
import { Skeleton, TableSkeleton } from "@/shared/components/common/Skeleton";
import { useNotification } from "@/shared/hooks/useNotification";
import { useCustomerPayments } from "../hooks/useCustomerPayments";
import { recordCustomerPayment, scanCustomerPaymentReceipt } from "../api/customer-payments.api";
import { useCustomers } from "@/modules/customers/hooks/useCustomers";
import { getCustomerUnpaidOrders } from "@/modules/customers/api/customers.api";

function formatMoney(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2
  }).format(Number(value ?? 0));
}

function formatDate(value) {
  if (!value) return "N/A";
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

function formatDateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getPaymentMethodIcon(value) {
  const normalized = String(value ?? "").toLowerCase().replace(/\s+/g, "_");
  if (normalized === "cash") return "fas fa-money-bill-wave";
  if (normalized === "cheque" || normalized === "check") return "fas fa-money-check";
  if (normalized === "bank_transfer") return "fas fa-university";
  if (normalized === "credit_card") return "fas fa-credit-card";
  return "fas fa-wallet";
}

function getPaymentMethodBadgeClasses(value) {
  const normalized = String(value ?? "").toLowerCase().replace(/\s+/g, "_");
  if (normalized.includes("cash")) return "border-[#a5d6a7] bg-[#e8f5e9] text-[#2e7d32]";
  if (normalized.includes("cheque") || normalized.includes("check")) return "border-[#b0bec5] bg-[#f5f7f9] text-[#546e7a]";
  if (normalized.includes("bank")) return "border-[#ce93d8] bg-[#f3e5f5] text-[#6a1b9a]";
  if (normalized.includes("credit")) return "border-[#ffcc80] bg-[#fff3e0] text-[#e65100]";
  return "border-border bg-surface text-ink";
}

function extractErrorMessage(error, fallbackMessage) {
  return error?.response?.data?.message || error?.message || fallbackMessage;
}

const paymentMethodOptions = [
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "credit_card", label: "Credit Card" },
  { value: "other", label: "Other" }
];

function createDefaultPaymentForm() {
  return {
    customerId: "",
    date: formatDateInput(new Date()),
    amount: "",
    paymentMethod: "",
    referenceNumber: "",
    notes: "",
    proofFile: null,
    proofName: "",
    proofPreviewUrl: ""
  };
}

export function CustomerPaymentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const externalSearch = (searchParams.get("search") ?? "").trim();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState(externalSearch);
  const deferredSearch = useDeferredValue(searchInput.trim());
  const notify = useNotification();
  const queryClient = useQueryClient();

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState(() => createDefaultPaymentForm());
  const [proofInputKey, setProofInputKey] = useState(0);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    const openModalParam = searchParams.get("openModal");
    const customerIdParam = searchParams.get("customerId");

    if (openModalParam === "true") {
      openPaymentModal();
      if (customerIdParam) {
        setPaymentForm((prev) => ({ ...prev, customerId: customerIdParam }));
      }
      
      // Clear params after extraction to prevent re-opening on reload
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("openModal");
      newParams.delete("customerId");
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    setPage(1);
    setSearchInput(externalSearch);
  }, [externalSearch]);

  // For Detail Viewing
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [allocationPayment, setAllocationPayment] = useState(null);

  const { data, isLoading, isError, error, isFetching } = useCustomerPayments({
    page,
    limit: 10,
    search: deferredSearch
  });

  // Fetch only customers with receivables for the recording modal
  const { data: customersWithArResponse } = useCustomers({ 
    page: 1, 
    perPage: 1000, 
    status: true,
    hasReceivables: true 
  });
  const customersWithAr = customersWithArResponse?.data ?? [];

  const selectedCustomerId = paymentForm.customerId;
  const { data: unpaidResponse, isLoading: isUnpaidLoading } = useQuery({
    queryKey: ["customer-unpaid-orders", selectedCustomerId],
    enabled: Boolean(selectedCustomerId),
    queryFn: () => getCustomerUnpaidOrders(selectedCustomerId)
  });

  const recordPaymentMutation = useMutation({
    mutationFn: recordCustomerPayment,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["customer-payments-list"] });
      notify.success("Customer payment recorded successfully");
      closePaymentModal();
    },
    onError: (error) => {
      notify.error(extractErrorMessage(error, "Failed to record payment"));
    }
  });

  const scanReceiptMutation = useMutation({
    mutationFn: scanCustomerPaymentReceipt,
    onMutate: () => setIsScanning(true),
    onSuccess: (response) => {
      const parsed = response?.data ?? response;
      setPaymentForm((current) => ({
        ...current,
        referenceNumber: parsed?.reference_number && parsed.reference_number !== "Not Found"
          ? parsed.reference_number
          : current.referenceNumber,
        amount: parsed?.amount && parsed.amount !== "0.00" ? String(parsed.amount) : current.amount,
        date: parsed?.date
          ? (() => {
              const [day, month, year] = String(parsed.date).split("-");
              return day && month && year ? `${year}-${month}-${day}` : current.date;
            })()
          : current.date
      }));
      notify.info("Receipt scanned. Please verify extracted data.");
    },
    onSettled: () => setIsScanning(false)
  });

  useEffect(() => () => {
    if (paymentForm.proofPreviewUrl) {
      URL.revokeObjectURL(paymentForm.proofPreviewUrl);
    }
  }, [paymentForm.proofPreviewUrl]);

  const payments = data?.data ?? [];
  const meta = data?.meta;

  const unpaidOrders = unpaidResponse?.data?.unpaid_orders ?? [];
  const totalOutstanding = unpaidResponse?.data?.summary?.total_outstanding ?? 0;

  const allocationPreview = (() => {
    const amount = Number(paymentForm.amount);
    if (!amount || amount <= 0 || unpaidOrders.length === 0) return [];

    let remainingPayment = amount;
    return [...unpaidOrders]
      .sort((a, b) => new Date(a.due_date || 0) - new Date(b.due_date || 0))
      .reduce((acc, order) => {
        if (remainingPayment <= 0) return acc;
        const balance = Number(order.outstanding_amount ?? 0);
        const applied = Math.min(remainingPayment, balance);
        if (applied > 0) {
          acc.push({
            orderId: order.id,
            orderNumber: order.is_opening_balance ? "Opening Balance" : order.invoice_number || order.order_number,
            invoiceDate: order.invoice_date,
            dueDate: order.due_date,
            balance,
            payment: applied,
            remaining: balance - applied,
            isOverdue: order.is_overdue
          });
          remainingPayment -= applied;
        }
        return acc;
      }, []);
  })();

  const excessAmount = Math.max(0, Number(paymentForm.amount) - totalOutstanding);

  function openPaymentModal() {
    setPaymentForm(createDefaultPaymentForm());
    setProofInputKey((k) => k + 1);
    setShowPaymentModal(true);
  }

  function closePaymentModal() {
    if (paymentForm.proofPreviewUrl) URL.revokeObjectURL(paymentForm.proofPreviewUrl);
    setPaymentForm(createDefaultPaymentForm());
    setProofInputKey((k) => k + 1);
    setShowPaymentModal(false);
  }

  function handlePaymentFieldChange(field, value) {
    setPaymentForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleProofFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      notify.warning("Invalid file type. Please upload an image.");
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setPaymentForm((prev) => {
      if (prev.proofPreviewUrl) URL.revokeObjectURL(prev.proofPreviewUrl);
      return { ...prev, proofFile: file, proofName: file.name, proofPreviewUrl: previewUrl };
    });
    const fd = new FormData();
    fd.append("payment_image", file);
    scanReceiptMutation.mutate(fd);
  }

  function handleRemoveProof() {
    if (paymentForm.proofPreviewUrl) URL.revokeObjectURL(paymentForm.proofPreviewUrl);
    setPaymentForm(prev => ({ ...prev, proofFile: null, proofName: "", proofPreviewUrl: "" }));
    setProofInputKey(k => k + 1);
  }

  async function handleRecordPayment(e) {
    e.preventDefault();
    if (!paymentForm.customerId) return notify.warning("Customer is required");
    if (!paymentForm.amount || Number(paymentForm.amount) <= 0) return notify.warning("Valid amount is required");
    if (!paymentForm.paymentMethod) return notify.warning("Payment method is required");
    if (!paymentForm.date) return notify.warning("Payment date is required");
    if (!paymentForm.proofFile) return notify.warning("Payment proof is required");

    const fd = new FormData();
    fd.append("customer_id", paymentForm.customerId);
    fd.append("date", paymentForm.date);
    fd.append("amount", paymentForm.amount);
    fd.append("payment_method", paymentForm.paymentMethod);
    if (paymentForm.referenceNumber) fd.append("reference_number", paymentForm.referenceNumber);
    if (paymentForm.notes) fd.append("notes", paymentForm.notes);
    fd.append("proof_image", paymentForm.proofFile);

    await recordPaymentMutation.mutateAsync(fd);
  }

  return (
    <div className="space-y-4">
      <section className="erp-page-section erp-page-section-joined">
        <div className="erp-page-header">
          <div className="flex items-center gap-3">
            <i className="fas fa-hand-holding-usd text-[18px] text-[#2c5f8a]" />
            <div>
              <div className="erp-page-title">Customer Collections</div>
              <div className="erp-page-description">Record and track payments received from customers across the system.</div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={openPaymentModal}
              className="erp-header-primary-button"
            >
              <i className="fas fa-plus mr-2" />
              Record Payment
            </button>
          </div>
        </div>

        <div className="erp-page-filters">
          <div className="erp-filter-label">
            <i className="fas fa-filter mr-1" />
            Filters
          </div>

          <div className="relative min-w-[280px] flex-1 md:max-w-[400px]">
            <i className="fas fa-search pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#90a4ae]" />
            <input
              value={searchInput}
              onChange={(e) => { setPage(1); setSearchInput(e.target.value); }}
              placeholder="Search payment #, reference, or customer..."
              className="erp-input pl-7"
            />
          </div>
          <button
            onClick={() => setSearchInput("")}
            className="erp-filter-clear-button"
          >
            <i className="fas fa-times mr-1" />
            Clear
          </button>
        </div>
      </section>

      <section className="erp-page-main-card erp-page-main-card-joined">
        <div className="overflow-x-auto">
          <table className={`erp-table w-full ${isLoading ? "opacity-70" : ""}`}>
            <thead>
              <tr>
                <th className="w-[120px]">Payment #</th>
                <th>Customer</th>
                <th className="w-[120px]">Date</th>
                <th className="w-[140px]">Method</th>
                <th className="w-[150px] text-right">Amount</th>
                <th className="w-[120px] text-center">Allocated</th>
                <th className="w-[100px] text-center">Status</th>
                <th className="w-[80px] text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableSkeleton rows={8}>
                  {(index) => (
                    <tr key={index}>
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j}><Skeleton className="h-4 w-full" /></td>
                      ))}
                    </tr>
                  )}
                </TableSkeleton>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[12px] italic text-[#90a4ae]">No collection records found.</td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id}>
                    <td className="font-mono font-bold text-[#1a3557]">{p.payment_number}</td>
                    <td>
                      <div className="font-bold text-[#1a3557]">{p.customer?.name}</div>
                      <div className="text-[10px] text-[#90a4ae]">{p.customer?.company}</div>
                    </td>
                    <td className="text-[11px] font-semibold text-[#1a3557]">{formatDate(p.date)}</td>
                    <td>
                      <div className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 text-[10px] font-bold ${getPaymentMethodBadgeClasses(p.payment_method)}`}>
                        <i className={getPaymentMethodIcon(p.payment_method)} />
                        <span className="capitalize">{p.payment_method.replace("_", " ")}</span>
                      </div>
                    </td>
                    <td className="text-right font-mono font-bold text-[#1a3557]">{formatMoney(p.amount)}</td>
                    <td className="text-center">
                      <button 
                        onClick={() => setAllocationPayment(p)}
                        className="text-[11px] font-bold text-[#0070b8] hover:underline"
                      >
                        <i className="fas fa-link mr-1" />
                        {p.allocations?.length || 0} items
                      </button>
                    </td>
                    <td className="text-center">
                      <span className="rounded-sm border border-[#a5d6a7] bg-[#e8f5e9] px-2 py-0.5 text-[9px] font-bold uppercase text-[#2e7d32]">Verified</span>
                    </td>
                    <td className="text-center">
                      <button 
                        onClick={() => setSelectedPayment(p)}
                        className="erp-icon-button"
                        title="View Proof"
                      >
                        <i className="fas fa-image" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!isLoading && meta?.totalPages > 1 && (
          <Pagination
            currentPage={page}
            lastPage={meta.totalPages}
            total={meta.total}
            perPage={10}
            onNext={() => setPage(p => p + 1)}
            onPrevious={() => setPage(p => p - 1)}
            onGoto={setPage}
          />
        )}
      </section>

      {/* RECORD PAYMENT MODAL */}
      <FormModal show={showPaymentModal} title="Record Customer Payment" size="2xl" onClose={closePaymentModal}>
        <form onSubmit={handleRecordPayment} className="space-y-4">
          <div className="space-y-4">
            {/* Customer Selection */}
            <div>
              <label className="erp-label">Customer <span className="text-[#c62828]">*</span></label>
              <div className="relative">
                <i className="fas fa-user absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#90a4ae]" />
                <select
                  className="erp-select pl-7"
                  value={paymentForm.customerId}
                  onChange={(e) => handlePaymentFieldChange("customerId", e.target.value)}
                >
                  <option value="">Select customer with outstanding balance...</option>
                  {customersWithAr.map(c => (
                    <option key={c.id} value={c.id}>{c.name} {c.company ? `(${c.company})` : ""}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Outstanding Summary Bar */}
            {paymentForm.customerId && (
              <div className="flex items-center justify-between rounded-sm border border-[#2c5f8a] bg-[#0070b8] px-4 py-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.5px] text-[#90caf9]">Total Outstanding</div>
                  <div className="font-mono text-[20px] font-bold text-white">{formatMoney(totalOutstanding)}</div>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-[#90caf9]">
                  <i className="fas fa-file-invoice-dollar text-[20px]" />
                  <span>{unpaidOrders.length} unpaid items</span>
                </div>
              </div>
            )}

            {/* Proof Upload & Scan Section */}
            <div>
              <label className="erp-label">Payment Proof & Receipt Scan <span className="text-[#c62828]">*</span></label>
              <div 
                className={`relative flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-sm border-2 border-dashed border-[#b0bec5] bg-[#f9fafc] transition hover:border-[#0070b8] ${paymentForm.proofPreviewUrl ? "p-1" : "p-6"}`}
                onClick={() => !paymentForm.proofPreviewUrl && document.getElementById("proof-input-global").click()}
              >
                <input 
                  id="proof-input-global"
                  key={proofInputKey} 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleProofFileChange} 
                />
                
                {!paymentForm.proofPreviewUrl ? (
                  <>
                    <i className="fas fa-cloud-upload-alt mb-2 text-[28px] text-[#90a4ae]" />
                    <div className="text-[12px] font-bold text-[#546e7a]">Click to upload and auto-fill details</div>
                    <div className="text-[10px] text-[#90a4ae]">JPG, PNG, JPEG · Max 5MB</div>
                  </>
                ) : (
                  <div className="relative h-full w-full">
                    <img src={paymentForm.proofPreviewUrl} alt="Proof" className="max-h-[220px] w-full rounded-sm object-contain" />
                    {isScanning && (
                      <div className="pointer-events-none absolute inset-0 overflow-hidden">
                        <div className="scan-laser" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleRemoveProof(); }}
                      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[#c62828] text-white shadow-md transition hover:bg-[#b71c1c]"
                    >
                      <i className="fas fa-times text-[12px]" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Date and Amount */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="erp-label">Payment Date <span className="text-[#c62828]">*</span></label>
                <div className="relative">
                  <i className="fas fa-calendar absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#90a4ae]" />
                  <input
                    type="date"
                    className="erp-input pl-7"
                    value={paymentForm.date}
                    onChange={(e) => handlePaymentFieldChange("date", e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="erp-label">Amount Received <span className="text-[#c62828]">*</span></label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#546e7a]">₱</span>
                  <input
                    type="number"
                    step="0.01"
                    className="erp-input pl-6"
                    placeholder="0.00"
                    value={paymentForm.amount}
                    onChange={(e) => handlePaymentFieldChange("amount", e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Method and Reference */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="erp-label">Payment Method <span className="text-[#c62828]">*</span></label>
                <div className="relative">
                  <i className="fas fa-wallet absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#90a4ae]" />
                  <select
                    className="erp-select pl-7"
                    value={paymentForm.paymentMethod}
                    onChange={(e) => handlePaymentFieldChange("paymentMethod", e.target.value)}
                  >
                    <option value="">Select method...</option>
                    {paymentMethodOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="erp-label">Reference Number</label>
                <div className="relative">
                  <i className="fas fa-hashtag absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#90a4ae]" />
                  <input
                    className="erp-input pl-7"
                    placeholder="e.g. Check #, Or #"
                    value={paymentForm.referenceNumber}
                    onChange={(e) => handlePaymentFieldChange("referenceNumber", e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="erp-label">Optional Notes</label>
              <textarea
                className="erp-input min-h-[60px]"
                placeholder="Additional details..."
                value={paymentForm.notes}
                onChange={(e) => handlePaymentFieldChange("notes", e.target.value)}
              />
            </div>

            {/* Allocation Table Preview */}
            {Number(paymentForm.amount) > 0 && allocationPreview.length > 0 && (
              <div className="overflow-hidden rounded-sm border border-[#d3e1ea]">
                <div className="flex items-center justify-between bg-[#1a3557] px-4 py-2">
                  <div className="text-[10px] font-bold uppercase tracking-[0.8px] text-[#90caf9]">
                    <i className="fas fa-link mr-1.5" />
                    Auto Allocation Preview (Oldest First)
                  </div>
                  <div className="text-[10px] text-[#b3d4f0]">Calculated</div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] border-collapse">
                    <thead>
                      <tr>
                        <th className="border-r border-[#4a7fa8] bg-[#2c5f8a] px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.3px] text-white">Ref #</th>
                        <th className="border-r border-[#4a7fa8] bg-[#2c5f8a] px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.3px] text-white">Date</th>
                        <th className="border-r border-[#4a7fa8] bg-[#2c5f8a] px-3 py-2 text-right text-[10px] font-bold uppercase tracking-[0.3px] text-white">Balance</th>
                        <th className="border-r border-[#4a7fa8] bg-[#2c5f8a] px-3 py-2 text-right text-[10px] font-bold uppercase tracking-[0.3px] text-white">Payment</th>
                        <th className="bg-[#2c5f8a] px-3 py-2 text-right text-[10px] font-bold uppercase tracking-[0.3px] text-white">Remaining</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allocationPreview.map((row) => (
                        <tr key={row.orderId} className={`border-b border-[#dde3e8] ${row.isOverdue ? "bg-[#fff5f5]" : "bg-white"}`}>
                          <td className="px-3 py-2 text-[11px] font-bold font-mono text-[#1a3557]">
                            <div className="flex items-center gap-1.5">
                              {row.orderNumber}
                              {row.isOverdue && <span className="rounded-sm bg-[#c62828] px-1.5 py-0.5 text-[8px] font-bold text-white">OVERDUE</span>}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-[10px] text-[#90a4ae]">{formatDate(row.invoiceDate)}</td>
                          <td className="px-3 py-2 text-right font-mono text-[11px] text-[#1a3557]">{formatMoney(row.balance)}</td>
                          <td className="px-3 py-2 text-right font-mono text-[11px] font-bold text-[#2e7d32]">{formatMoney(row.payment)}</td>
                          <td className={`px-3 py-2 text-right font-mono text-[11px] font-bold ${row.remaining === 0 ? "text-[#2e7d32]" : "text-[#e65100]"}`}>{formatMoney(row.remaining)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {excessAmount > 0 && (
                  <div className="m-3 flex items-start gap-2.5 rounded-sm border border-[#90caf9] bg-[#e8f1f8] px-3 py-2.5">
                    <i className="fas fa-info-circle mt-0.5 text-[14px] text-[#0070b8]" />
                    <div>
                      <div className="text-[12px] font-bold text-[#212121]">Excess Amount</div>
                      <div className="text-[11px] text-[#546e7a]">{formatMoney(excessAmount)} will be saved as advance credit for this customer.</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 pt-5 border-t border-[#e8eef3] sm:flex-row sm:justify-end">
            <button type="button" onClick={closePaymentModal} className="erp-button-secondary">Cancel</button>
            <button
              type="submit"
              disabled={recordPaymentMutation.isPending || isScanning}
              className="inline-flex items-center justify-center gap-1.5 rounded-sm bg-[#2e7d32] px-3.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-[#1b5e20] disabled:cursor-not-allowed disabled:bg-[#b0bec5]"
            >
              <i className={`fas ${recordPaymentMutation.isPending ? "fa-spinner animate-spin" : "fa-check"}`} />
              {recordPaymentMutation.isPending ? "Recording..." : "Record Payment"}
            </button>
          </div>
        </form>
      </FormModal>

      {/* VIEW PROOF MODAL */}
      <FormModal
        show={Boolean(selectedPayment)}
        size="max-w-[700px]"
        hideHeader
        bodyClassName="p-0"
        panelClassName="overflow-hidden bg-white shadow-2xl"
        onClose={() => setSelectedPayment(null)}
      >
        {selectedPayment && (
          <div className="flex min-h-[400px] flex-col md:flex-row">
            <div className="flex flex-1 flex-col border-r border-[#f1f1f1]">
              <div className="flex items-center gap-3 bg-[#0070b8] px-4 py-3.5 text-white">
                <i className="fas fa-receipt text-[18px]" />
                <div className="text-[14px] font-bold uppercase tracking-wider">Proof of Payment</div>
              </div>
              <div className="flex-1 overflow-y-auto p-5">
                <div className="space-y-4">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-[#90a4ae]">Transaction Ref</div>
                    <div className="font-mono text-[13px] font-bold text-[#1a3557]">{selectedPayment.payment_number}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-[#90a4ae]">Customer</div>
                    <div className="text-[12px] font-bold text-[#1a3557]">{selectedPayment.customer?.name}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-[#90a4ae]">Amount Paid</div>
                    <div className="font-mono text-[20px] font-bold text-[#2e7d32]">{formatMoney(selectedPayment.amount)}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-[#90a4ae]">Date</div>
                      <div className="text-[12px] text-[#1a3557]">{formatDate(selectedPayment.date)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-[#90a4ae]">Method</div>
                      <div className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-[10px] font-bold ${getPaymentMethodBadgeClasses(selectedPayment.payment_method)}`}>
                        <i className={getPaymentMethodIcon(selectedPayment.payment_method)} />
                        <span className="capitalize">{selectedPayment.payment_method.replace("_", " ")}</span>
                      </div>
                    </div>
                  </div>
                  {selectedPayment.reference_number && (
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-[#90a4ae]">External ID</div>
                      <div className="font-mono text-[12px] text-[#1a3557]">{selectedPayment.reference_number}</div>
                    </div>
                  )}
                  {selectedPayment.allocations?.length > 0 && (
                    <div className="border-t border-dashed border-[#dde3e8] pt-4">
                      <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#90a4ae]">Allocated To</div>
                      <div className="space-y-1.5">
                        {selectedPayment.allocations.map(a => (
                          <div key={a.id} className="flex items-center justify-between rounded-sm border border-[#e2e8f0] bg-[#f8fafc] px-2.5 py-1.5">
                            <span className="font-mono text-[11px] font-bold text-[#1a3557]">{a.invoice_number || "Opening Balance"}</span>
                            <span className="font-mono text-[11px] font-bold text-[#2e7d32]">{formatMoney(a.allocated_amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="bg-[#f9fafb] p-4 text-right">
                <button 
                  onClick={() => setSelectedPayment(null)}
                  className="rounded-sm bg-[#1a3557] px-5 py-2 text-[12px] font-bold text-white hover:bg-[#2c5f8a]"
                >
                  Close Viewer
                </button>
              </div>
            </div>
            <div className="flex w-full items-center justify-center bg-[#1a3557] p-4 md:w-[320px]">
              <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-md border border-white/10 bg-white/5">
                {selectedPayment.proof_image_url ? (
                  <img src={selectedPayment.proof_image_url} alt="Proof" className="max-h-[450px] max-w-full object-contain" />
                ) : (
                  <div className="text-[11px] italic text-white/50">No receipt image attached</div>
                )}
              </div>
            </div>
          </div>
        )}
      </FormModal>

      {/* ALLOCATIONS LIST MODAL */}
      <FormModal
        show={Boolean(allocationPayment)}
        size="2xl"
        title={`Allocation Details · ${allocationPayment?.payment_number}`}
        onClose={() => setAllocationPayment(null)}
      >
        {allocationPayment && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-sm border border-[#d7e3ec] bg-[#f8fbfd] p-3">
                <div className="text-[10px] font-bold uppercase text-[#607d8b]">Total Amount</div>
                <div className="mt-1 text-[13px] font-bold text-[#1a3557]">{formatMoney(allocationPayment.amount)}</div>
              </div>
              <div className="rounded-sm border border-[#d7e3ec] bg-[#f8fbfd] p-3">
                <div className="text-[10px] font-bold uppercase text-[#607d8b]">Payment Date</div>
                <div className="mt-1 text-[13px] font-bold text-[#1a3557]">{formatDate(allocationPayment.date)}</div>
              </div>
              <div className="rounded-sm border border-[#d7e3ec] bg-[#f8fbfd] p-3">
                <div className="text-[10px] font-bold uppercase text-[#607d8b]">Method</div>
                <div className="mt-1 text-[13px] font-bold text-[#1a3557] capitalize">{allocationPayment.payment_method.replace("_", " ")}</div>
              </div>
            </div>
            <div className="overflow-x-auto rounded-sm border border-[#d3dee7]">
              <table className="erp-table w-full">
                <thead>
                  <tr>
                    <th>Invoice / Reference</th>
                    <th>Sales Order</th>
                    <th className="text-right">Allocated Amount</th>
                    <th className="text-right">Allocation Date</th>
                  </tr>
                </thead>
                <tbody>
                  {allocationPayment.allocations?.map(a => (
                    <tr key={a.id}>
                      <td className="font-mono font-bold text-[#1a3557]">{a.invoice_number || "Opening Balance"}</td>
                      <td className="font-mono text-[11px]">{a.order_number || "—"}</td>
                      <td className="text-right font-mono font-bold text-[#2e7d32]">{formatMoney(a.allocated_amount)}</td>
                      <td className="text-right text-[11px] text-[#90a4ae]">{formatDate(a.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </FormModal>
    </div>
  );
}
