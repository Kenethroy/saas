import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FormModal } from "@/shared/components/common/FormModal";
import { Pagination } from "@/shared/components/common/Pagination";
import { Skeleton } from "@/shared/components/common/Skeleton";
import { useNotification } from "@/shared/hooks/useNotification";
import {
  getCustomerDetails,
  getCustomerOrders,
  getCustomerPayments,
  getCustomerPerformanceInsight,
  getCustomerReturns,
  getCustomerStatementPdf,
  getCustomerUnpaidOrders,
  recordCustomerPayment,
  scanCustomerPaymentReceipt
} from "@/modules/customers/api/customers.api";

function formatMoney(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2
  }).format(Number(value ?? 0));
}

function formatDate(value) {
  if (!value) {
    return "N/A";
  }

  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(new Date(value));
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

function humanizeStatus(value) {
  if (!value) {
    return "N/A";
  }

  return String(value)
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getBadgeClasses(value) {
  const normalized = String(value ?? "").toLowerCase();

  if (["paid", "completed", "active", "delivered"].includes(normalized)) {
    return "border-[#a5d6a7] bg-[#e8f5e9] text-[#2e7d32]";
  }

  if (["partial", "processing", "approved", "pending", "for delivery", "for_delivery"].includes(normalized)) {
    return "border-[#ffe082] bg-[#fff8e1] text-[#f57f17]";
  }

  if (["cancelled", "rejected", "inactive"].includes(normalized)) {
    return "border-[#ef9a9a] bg-[#fff5f5] text-[#c62828]";
  }

  return "border-[#b0bec5] bg-[#f3f6f9] text-[#546e7a]";
}

function getPaymentMethodIcon(value) {
  const normalized = String(value ?? "").toLowerCase().replace(/\s+/g, "_");

  if (normalized === "cash") {
    return "fas fa-money-bill-wave";
  }

  if (normalized === "cheque" || normalized === "check") {
    return "fas fa-money-check";
  }

  if (normalized === "bank_transfer") {
    return "fas fa-university";
  }

  if (normalized === "credit_card") {
    return "fas fa-credit-card";
  }

  return "fas fa-wallet";
}

function getPaymentMethodBadgeClasses(value) {
  const normalized = String(value ?? "").toLowerCase().replace(/\s+/g, "_");

  if (normalized === "cash") {
    return "border-[#a5d6a7] bg-[#e8f5e9] text-[#2e7d32]";
  }

  if (normalized === "cheque" || normalized === "check") {
    return "border-[#b0bec5] bg-[#f3f6f9] text-[#546e7a]";
  }

  if (normalized === "bank_transfer") {
    return "border-[#d1c4e9] bg-[#f3e5f5] text-[#6a1b9a]";
  }

  if (normalized === "credit_card") {
    return "border-[#ffcc80] bg-[#fff3e0] text-[#e65100]";
  }

  return "border-[#90caf9] bg-[#e8f1f8] text-[#0070b8]";
}

function extractErrorMessage(error, fallbackMessage) {
  return error?.response?.data?.message || error?.message || fallbackMessage;
}

async function resolveBlobErrorMessage(error) {
  const responseData = error?.response?.data;

  if (responseData instanceof Blob) {
    try {
      const text = await responseData.text();
      if (!text) {
        return "Failed to generate statement.";
      }

      try {
        const parsed = JSON.parse(text);
        return parsed?.message ?? text;
      } catch {
        return text;
      }
    } catch {
      return "Failed to generate statement.";
    }
  }

  return extractErrorMessage(error, "Failed to generate statement.");
}

function StatCard({ label, value, hint, className = "" }) {
  return (
    <div className={`rounded-sm border border-[#dce5ec] bg-white px-4 py-3 shadow-[0_6px_18px_rgba(15,23,42,0.05)] ${className}`}>
      <div className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#607d8b]">{label}</div>
      <div className="mt-2 text-[18px] font-extrabold tracking-[0.2px] text-[#1a3557]">{value}</div>
      {hint ? <div className="mt-1 text-[10px] text-[#90a4ae]">{hint}</div> : null}
    </div>
  );
}

function TableEmptyState({ colSpan, message }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-[11px] italic text-[#90a4ae]">
        {message}
      </td>
    </tr>
  );
}

function SectionCard({ title, description, actions = null, children, className = "", headerClassName = "", bodyClassName = "" }) {
  return (
    <section className={`overflow-hidden rounded-sm border border-[#dce5ec] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)] ${className}`}>
      <div className={`flex flex-col gap-3 border-b border-[#e8eef3] bg-[#f8fbfd] px-4 py-3 md:flex-row md:items-center md:justify-between ${headerClassName}`}>
        <div>
          <div className="text-[13px] font-bold text-[#1a3557]">{title}</div>
          {description ? <div className="mt-0.5 text-[10px] text-[#607d8b]">{description}</div> : null}
        </div>
        {actions}
      </div>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

const paymentMethodOptions = [
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "credit_card", label: "Credit Card" },
  { value: "other", label: "Other" }
];

const customerDetailTabs = [
  { key: "orders", label: "Orders", icon: "fas fa-shopping-cart" },
  { key: "payments", label: "Payment History", icon: "fas fa-money-bill-wave" },
  { key: "returns", label: "Returns", icon: "fas fa-undo" }
];

function createDefaultPaymentForm() {
  return {
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

export function CustomerDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const notify = useNotification();
  const queryClient = useQueryClient();

  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersStatus, setOrdersStatus] = useState("");
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [returnsPage, setReturnsPage] = useState(1);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showStatementModal, setShowStatementModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [allocationPayment, setAllocationPayment] = useState(null);
  const [paymentForm, setPaymentForm] = useState(() => createDefaultPaymentForm());
  const [proofInputKey, setProofInputKey] = useState(0);
  const [statementFilters, setStatementFilters] = useState({
    from: formatDateInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
    to: formatDateInput(new Date())
  });

  const {
    data: detailsResponse,
    isLoading: isDetailsLoading,
    isError: isDetailsError,
    error: detailsError
  } = useQuery({
    queryKey: ["customer-detail", id],
    enabled: Boolean(id),
    queryFn: () => getCustomerDetails(id)
  });

  const {
    data: ordersResponse,
    isLoading: isOrdersLoading,
    isFetching: isOrdersFetching
  } = useQuery({
    queryKey: ["customer-orders", id, ordersPage, ordersStatus],
    enabled: Boolean(id),
    queryFn: () =>
      getCustomerOrders(id, {
        page: ordersPage,
        limit: 10,
        ...(ordersStatus ? { status: ordersStatus } : {})
      }),
    placeholderData: keepPreviousData
  });

  const {
    data: unpaidResponse,
    isLoading: isUnpaidLoading
  } = useQuery({
    queryKey: ["customer-unpaid-orders", id],
    enabled: Boolean(id),
    queryFn: () => getCustomerUnpaidOrders(id)
  });

  const {
    data: paymentsResponse,
    isLoading: isPaymentsLoading,
    isFetching: isPaymentsFetching
  } = useQuery({
    queryKey: ["customer-payments", id, paymentsPage],
    enabled: Boolean(id),
    queryFn: () => getCustomerPayments(id, { page: paymentsPage, limit: 10 }),
    placeholderData: keepPreviousData
  });

  const {
    data: returnsResponse,
    isLoading: isReturnsLoading,
    isFetching: isReturnsFetching
  } = useQuery({
    queryKey: ["customer-returns", id, returnsPage],
    enabled: Boolean(id),
    queryFn: () => getCustomerReturns(id, { page: returnsPage, limit: 10 }),
    placeholderData: keepPreviousData
  });

  const {
    data: insightResponse
  } = useQuery({
    queryKey: ["customer-performance-insight", id],
    enabled: Boolean(id),
    retry: false,
    queryFn: () => getCustomerPerformanceInsight(id)
  });

  const recordPaymentMutation = useMutation({
    mutationFn: recordCustomerPayment,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["customer-detail", id] }),
        queryClient.invalidateQueries({ queryKey: ["customer-unpaid-orders", id] }),
        queryClient.invalidateQueries({ queryKey: ["customer-payments", id] })
      ]);
      notify.success("Customer payment recorded successfully");
      closePaymentModal();
    },
    onError: (error) => {
      notify.error(extractErrorMessage(error, "Failed to record payment"));
    }
  });

  const scanReceiptMutation = useMutation({
    mutationFn: scanCustomerPaymentReceipt,
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
      notify.info("Receipt scanned. Review the autofilled values before saving.");
    },
    onError: () => {
      notify.warning("Unable to scan the payment proof. You can still enter the details manually.");
    }
  });

  useEffect(() => () => {
    if (paymentForm.proofPreviewUrl) {
      URL.revokeObjectURL(paymentForm.proofPreviewUrl);
    }
  }, [paymentForm.proofPreviewUrl]);

  const details = detailsResponse?.data ?? null;
  const customer = details?.customer ?? null;
  const statistics = details?.statistics ?? null;
  const orders = ordersResponse?.data?.orders ?? [];
  const ordersMeta = ordersResponse?.data?.pagination ?? {};
  const unpaidOrders = unpaidResponse?.data?.unpaid_orders ?? [];
  const unpaidSummary = unpaidResponse?.data?.summary ?? {};
  const payments = paymentsResponse?.data?.payments ?? [];
  const paymentsMeta = paymentsResponse?.data?.pagination ?? {};
  const returns = returnsResponse?.data?.returns ?? [];
  const returnsMeta = returnsResponse?.data?.pagination ?? {};
  const insight = insightResponse?.insight ?? insightResponse?.data?.insight ?? "Performance insight is currently unavailable.";
  const activeTab = customerDetailTabs.some((tab) => tab.key === searchParams.get("tab"))
    ? searchParams.get("tab")
    : "orders";
  const allocationPreview = (() => {
    const amount = Number(paymentForm.amount);
    if (!amount || amount <= 0 || unpaidOrders.length === 0) {
      return [];
    }

    let remainingPayment = amount;
    const sortedOrders = [...unpaidOrders].sort((left, right) => {
      const leftDate = new Date(left.due_date || left.invoice_date || 0).getTime();
      const rightDate = new Date(right.due_date || right.invoice_date || 0).getTime();
      return leftDate - rightDate;
    });

    return sortedOrders.reduce((entries, order) => {
      if (remainingPayment <= 0) {
        return entries;
      }

      const balance = Number(order.outstanding_amount ?? 0);
      const applied = Math.min(remainingPayment, balance);

      if (applied <= 0) {
        return entries;
      }

      entries.push({
        orderId: order.id,
        orderNumber: order.is_opening_balance
          ? "Opening Balance"
          : order.invoice_number || order.order_number || "N/A",
        invoiceDate: order.invoice_date,
        dueDate: order.due_date,
        balance,
        payment: applied,
        remaining: balance - applied,
        isOverdue: Boolean(order.is_overdue)
      });

      remainingPayment -= applied;
      return entries;
    }, []);
  })();
  const excessAmount = (() => {
    const amount = Number(paymentForm.amount);
    if (!amount || amount <= 0 || unpaidOrders.length === 0) {
      return 0;
    }

    const totalUnpaid = unpaidOrders.reduce(
      (sum, order) => sum + Number(order.outstanding_amount ?? 0),
      0
    );
    const excess = amount - totalUnpaid;
    return excess > 0 ? excess : 0;
  })();
  const isPaymentSubmitDisabled =
    recordPaymentMutation.isPending ||
    !paymentForm.amount ||
    Number(paymentForm.amount) <= 0 ||
    !paymentForm.paymentMethod ||
    !paymentForm.date ||
    !paymentForm.proofFile;

  function handleTabChange(tabKey) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);

      if (tabKey === "orders") {
        next.delete("tab");
      } else {
        next.set("tab", tabKey);
      }

      return next;
    }, { replace: true });
  }

  function openPaymentModal() {
    setPaymentForm(createDefaultPaymentForm());
    setProofInputKey((current) => current + 1);
    setShowPaymentModal(true);
  }

  function closePaymentModal() {
    setPaymentForm((current) => {
      if (current.proofPreviewUrl) {
        URL.revokeObjectURL(current.proofPreviewUrl);
      }

      return createDefaultPaymentForm();
    });
    setProofInputKey((current) => current + 1);
    setShowPaymentModal(false);
  }

  function handlePaymentFieldChange(field, value) {
    setPaymentForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  function handleProofFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      notify.warning("Please upload an image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      notify.warning("File size must be less than 5MB.");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setPaymentForm((current) => {
      if (current.proofPreviewUrl) {
        URL.revokeObjectURL(current.proofPreviewUrl);
      }

      return {
        ...current,
        proofFile: file,
        proofName: file.name,
        proofPreviewUrl: previewUrl
      };
    });

    const formData = new FormData();
    formData.append("payment_image", file);
    scanReceiptMutation.mutate(formData);
  }

  function handleRemoveProof() {
    setPaymentForm((current) => {
      if (current.proofPreviewUrl) {
        URL.revokeObjectURL(current.proofPreviewUrl);
      }

      return {
        ...current,
        proofFile: null,
        proofName: "",
        proofPreviewUrl: ""
      };
    });
    setProofInputKey((current) => current + 1);
  }

  async function handleRecordPayment(event) {
    event.preventDefault();

    if (!paymentForm.amount || Number(paymentForm.amount) <= 0) {
      notify.warning("Payment amount is required.");
      return;
    }

    if (!paymentForm.paymentMethod) {
      notify.warning("Payment method is required.");
      return;
    }

    if (!paymentForm.date) {
      notify.warning("Payment date is required.");
      return;
    }

    if (!paymentForm.proofFile) {
      notify.warning("Payment proof image is required.");
      return;
    }

    const formData = new FormData();
    formData.append("customer_id", id);
    formData.append("date", paymentForm.date);
    formData.append("amount", paymentForm.amount);
    formData.append("payment_method", paymentForm.paymentMethod);

    if (paymentForm.referenceNumber) {
      formData.append("reference_number", paymentForm.referenceNumber);
    }

    if (paymentForm.notes) {
      formData.append("notes", paymentForm.notes);
    }

    formData.append("proof_image", paymentForm.proofFile);

    await recordPaymentMutation.mutateAsync(formData);
  }

  async function handleDownloadStatement() {
    try {
      const response = await getCustomerStatementPdf(id, {
        from: statementFilters.from || undefined,
        to: statementFilters.to || undefined
      });
      const blob = response.data;
      const disposition = response.headers["content-disposition"] || response.headers["Content-Disposition"];
      let fileName = `SOA-${id}-${new Date().toISOString().slice(0, 10)}.pdf`;

      if (disposition) {
        const match = disposition.match(/filename\*?=([^;]+);?/) || disposition.match(/filename="?([^";]+)"?/);
        if (match?.[1]) {
          fileName = match[1].replace(/UTF-8''/, "").replace(/"/g, "");
        }
      }

      const blobUrl = window.URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = blobUrl;
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
      setShowStatementModal(false);
      notify.success("Statement generated successfully");
    } catch (error) {
      notify.error(await resolveBlobErrorMessage(error));
    }
  }

  if (isDetailsError) {
    return (
      <section className="rounded-sm border border-[#ef9a9a] bg-[#fff5f5] px-4 py-8 text-[11px] text-[#c62828]">
        Failed to load customer details{detailsError?.message ? `: ${detailsError.message}` : "."}
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-sm border border-[#cfdce7] bg-white shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
        <div className="bg-[linear-gradient(180deg,#f8fbfd_0%,#eef5fa_100%)] px-5 py-5 text-[#1a3557]">
          <div className="flex flex-col gap-3 border-b border-[#dbe6ee] pb-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => navigate("/customers")}
                className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-sm border border-[#c3d4e1] bg-white text-[#1a3557] transition hover:border-[#8fb1c9] hover:bg-[#eef5fa]"
                title="Back to Customers"
              >
                <i className="fas fa-arrow-left text-[12px]" />
              </button>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.7px] text-[#607d8b]">Customer Details</div>
                <div className="mt-1 text-[12px] text-[#546e7a]">Collections, receivables, returns, and account performance</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                to={`/assistant?customerId=${id}&customerName=${encodeURIComponent(customer?.company_name || customer?.name || "Customer")}`}
                className="inline-flex items-center justify-center rounded-sm border border-[#c3d4e1] bg-white px-3.5 py-1.5 text-[11px] font-bold text-[#1a3557] transition hover:border-[#8fb1c9] hover:bg-[#eef5fa]"
              >
                <i className="fas fa-robot mr-1.5" />
                Ask Assistant
              </Link>
              <button
                type="button"
                onClick={openPaymentModal}
                className="inline-flex items-center justify-center rounded-sm bg-[#0070b8] px-3.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-[#005a94] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!customer}
              >
                <i className="fas fa-money-bill-wave mr-1.5" />
                Record Payment
              </button>
              <button
                type="button"
                onClick={() => setShowStatementModal(true)}
                className="inline-flex items-center justify-center rounded-sm border border-[#c3d4e1] bg-white px-3.5 py-1.5 text-[11px] font-bold text-[#1a3557] transition hover:border-[#8fb1c9] hover:bg-[#eef5fa] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!customer}
              >
                <i className="fas fa-file-pdf mr-1.5" />
                Statement PDF
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1.7fr_1fr]">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.7px] text-[#607d8b]">Customer Account</div>
              <div className="mt-2 text-[26px] font-extrabold tracking-[0.3px]">
                {isDetailsLoading ? <Skeleton className="h-7 w-64 bg-[#d9e6f0]" /> : customer?.name ?? "N/A"}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#546e7a]">
                <span>{customer?.company_name || "No company"}</span>
                <span>{customer?.email || "No email"}</span>
                <span>{customer?.phone || "No phone"}</span>
              </div>
              <div className="mt-2 text-[11px] text-[#546e7a]">{customer?.address || "No address set"}</div>
            </div>

            <div className="rounded-sm border border-[#d7e3ec] bg-white px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#607d8b]">Terms & Status</div>
              <div className="mt-3 space-y-2 text-[12px]">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[#607d8b]">Payment Terms</span>
                  <span className="font-bold">{customer?.payment_terms || "Cash / None"}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[#607d8b]">Member Since</span>
                  <span className="font-bold">{customer?.created_at ? formatDate(customer.created_at) : "N/A"}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[#607d8b]">Account Status</span>
                  <span className={`inline-flex items-center rounded-sm border px-2 py-0.5 text-[10px] font-bold uppercase ${customer?.status ? "border-[#a5d6a7] bg-[#e8f5e9] text-[#2e7d32]" : "border-[#ef9a9a] bg-[#fff5f5] text-[#c62828]"}`}>
                    {customer?.status ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 border-t border-[#dbe6ee] pt-5 md:grid-cols-2 xl:grid-cols-4">
            <StatCard className="border-[#d7e3ec] shadow-none" label="Total Spent" value={isDetailsLoading ? "..." : formatMoney(statistics?.total_spent)} hint={`${statistics?.total_orders ?? 0} total orders`} />
            <StatCard className="border-[#d7e3ec] shadow-none" label="Outstanding" value={isDetailsLoading ? "..." : formatMoney(statistics?.total_outstanding)} hint={`${statistics?.overdue_orders_count ?? 0} overdue account(s)`} />
            <StatCard className="border-[#d7e3ec] shadow-none" label="Overdue" value={isDetailsLoading ? "..." : formatMoney(statistics?.total_overdue)} hint={`${statistics?.overdue_orders_count ?? 0} overdue receivable(s)`} />
            <StatCard className="border-[#d7e3ec] shadow-none" label="Returns" value={isDetailsLoading ? "..." : formatMoney(statistics?.total_return_amount)} hint={`${statistics?.total_returns ?? 0} completed return(s)`} />
          </div>
        </div>

        <div className="grid gap-4 border-t border-[#dbe6ee] bg-[#fbfdff] px-5 py-5 xl:grid-cols-[1.7fr_1fr]">
          <SectionCard
            title="Unpaid Orders"
            description="Open invoices and opening balances still assigned to this customer."
            className="border-[#d7e3ec] shadow-none"
          >
            <div className="overflow-x-auto">
              <table className="w-full table-fixed border-collapse">
                <thead>
                  <tr>
                    <th className="w-[23%] border-b border-[#9fb3c2] bg-[#2c5f8a] px-2.5 py-2 text-left text-[10px] font-bold uppercase tracking-[0.3px] text-white">Reference</th>
                    <th className="w-[15%] border-b border-[#9fb3c2] bg-[#2c5f8a] px-2.5 py-2 text-left text-[10px] font-bold uppercase tracking-[0.3px] text-white">Invoice Date</th>
                    <th className="w-[17%] border-b border-[#9fb3c2] bg-[#2c5f8a] px-2.5 py-2 text-left text-[10px] font-bold uppercase tracking-[0.3px] text-white">Due Date</th>
                    <th className="w-[15%] border-b border-[#9fb3c2] bg-[#2c5f8a] px-2.5 py-2 text-right text-[10px] font-bold uppercase tracking-[0.3px] text-white">Total</th>
                    <th className="w-[18%] border-b border-[#9fb3c2] bg-[#2c5f8a] px-2.5 py-2 text-right text-[10px] font-bold uppercase tracking-[0.3px] text-white">Outstanding</th>
                    <th className="w-[12%] border-b border-[#9fb3c2] bg-[#2c5f8a] px-2.5 py-2 text-left text-[10px] font-bold uppercase tracking-[0.3px] text-white">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {isUnpaidLoading ? (
                    <TableEmptyState colSpan={6} message="Loading unpaid receivables..." />
                  ) : unpaidOrders.length === 0 ? (
                    <TableEmptyState colSpan={6} message="No unpaid orders for this customer." />
                  ) : (
                    unpaidOrders.map((entry) => (
                      <tr key={entry.id} className="border-t border-[#d3dee7] bg-[#fbfdff] align-top even:bg-[#f7fbfe] hover:bg-[#edf5fb]">
                        <td className="px-2.5 py-2 text-[11px] font-mono font-bold text-[#1a3557]">
                          {entry.is_opening_balance ? "Opening Balance" : entry.invoice_number || entry.order_number || "N/A"}
                        </td>
                        <td className="px-2.5 py-2 text-[10px] text-[#546e7a]">{formatDate(entry.invoice_date)}</td>
                        <td className="px-2.5 py-2 text-[10px] text-[#546e7a]">
                          <div>{formatDate(entry.due_date)}</div>
                          {entry.is_overdue ? <div className="mt-0.5 text-[10px] text-[#c62828]">{entry.days_overdue} day(s) overdue</div> : null}
                        </td>
                        <td className="px-2.5 py-2 text-right text-[10px] font-mono text-[#1a3557]">{formatMoney(entry.amount)}</td>
                        <td className="px-2.5 py-2 text-right text-[10px] font-mono font-bold text-[#c62828]">{formatMoney(entry.outstanding_amount)}</td>
                        <td className="px-2.5 py-2">
                          <span className={`inline-flex rounded-sm border px-1.5 py-0.5 text-[8px] font-bold uppercase leading-none ${getBadgeClasses(entry.status)}`}>
                            {humanizeStatus(entry.status)}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {unpaidOrders.length > 0 ? (
              <div className="grid gap-3 border-t border-[#e8eef3] bg-[#f8fbfd] px-4 py-3 md:grid-cols-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.5px] text-[#607d8b]">Total Outstanding</div>
                  <div className="mt-1 text-[15px] font-bold text-[#1a3557]">{formatMoney(unpaidSummary.total_outstanding)}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.5px] text-[#607d8b]">Total Overdue</div>
                  <div className="mt-1 text-[15px] font-bold text-[#c62828]">{formatMoney(unpaidSummary.total_overdue)}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.5px] text-[#607d8b]">Overdue Count</div>
                  <div className="mt-1 text-[15px] font-bold text-[#1a3557]">{unpaidSummary.overdue_orders_count ?? 0}</div>
                </div>
              </div>
            ) : null}
          </SectionCard>

          <SectionCard
            title="Performance Insight"
            description="Quick account summary generated from current customer activity."
            className="border-[#d7e3ec] shadow-none"
          >
            <div className="h-full bg-[radial-gradient(circle_at_top_left,#e8f4fb_0%,#f8fbfd_42%,#ffffff_100%)] px-4 py-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-sm bg-[#d9edf9] text-[#0070b8]">
                  <i className="fas fa-chart-line text-[15px]" />
                </div>
                <p className="text-[12px] leading-6 text-[#355163]">{insight}</p>
              </div>

              {statistics?.aging ? (
                <div className="mt-5 grid gap-2">
                  {[
                    ["Current", statistics.aging.current],
                    ["1-30 Days", statistics.aging.days_1_30],
                    ["31-60 Days", statistics.aging.days_31_60],
                    ["61-90 Days", statistics.aging.days_61_90],
                    ["90+ Days", statistics.aging.over_90]
                  ].map(([label, amount]) => (
                    <div key={label} className="flex items-center justify-between rounded-sm border border-[#e1eaf0] bg-white px-3 py-2 text-[11px]">
                      <span className="font-bold text-[#607d8b]">{label}</span>
                      <span className="font-mono font-bold text-[#1a3557]">{formatMoney(amount)}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </SectionCard>
        </div>

        <div className="border-t border-[#dbe6ee]">
      <section className="overflow-hidden bg-white">
        <div className="hide-scrollbar flex overflow-x-auto overflow-y-hidden border-b-2 border-[#dce5ec] bg-[#f3f6f9]">
          {customerDetailTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabChange(tab.key)}
              className={`-mb-0.5 whitespace-nowrap border-b-[3px] px-5 py-2.5 text-[12px] font-bold transition-all ${
                activeTab === tab.key
                  ? "border-[#0070b8] bg-white text-[#0070b8]"
                  : "border-transparent text-[#546e7a] hover:bg-[#e8f1f8] hover:text-[#0070b8]"
              }`}
            >
              <i className={`${tab.icon} mr-1.5`} />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "orders" ? (
          <div>
            <div className="flex flex-col gap-3 bg-[#1a3557] px-4 py-2 md:flex-row md:items-center md:justify-between">
              <div className="text-[10px] font-bold uppercase tracking-[0.8px] text-[#90caf9]">
                <i className="fas fa-shopping-cart mr-1.5" />
                Order History
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={ordersStatus}
                  onChange={(event) => {
                    setOrdersPage(1);
                    setOrdersStatus(event.target.value);
                  }}
                  className="erp-select h-8 min-w-[160px] border-[#b0bec5] bg-white text-[11px]"
                >
                  <option value="">All Orders</option>
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="for_delivery">For Delivery</option>
                  <option value="delivered">Delivered</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="erp-table w-full min-w-[880px]">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Date</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Invoice</th>
                    <th>Balance</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {isOrdersLoading ? (
                    <TableEmptyState colSpan={7} message="Loading customer orders..." />
                  ) : orders.length === 0 ? (
                    <TableEmptyState colSpan={7} message="No orders found for the current filter." />
                  ) : (
                    orders.map((order) => (
                      <tr key={order.id}>
                        <td className="font-mono text-[#1a3557]">{order.order_number}</td>
                        <td>{formatDate(order.date)}</td>
                        <td>{order.items_count}</td>
                        <td>{formatMoney(order.total_amount)}</td>
                        <td>{order.invoice_number || "N/A"}</td>
                        <td>{order.balance !== null ? formatMoney(order.balance) : "N/A"}</td>
                        <td>
                          <div className="flex flex-col gap-1">
                            <span className={`w-fit rounded-sm border px-1.5 py-0.5 text-[9px] font-bold uppercase ${getBadgeClasses(order.status_label)}`}>
                              {order.status_label}
                            </span>
                            {order.is_overdue ? <span className="text-[10px] text-[#c62828]">{order.days_overdue} day(s) overdue</span> : null}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={ordersMeta.current_page ?? 1}
              lastPage={ordersMeta.total_pages ?? 1}
              perPage={ordersMeta.per_page ?? 10}
              total={ordersMeta.total ?? 0}
              itemLabel="orders"
              loading={isOrdersFetching}
              onPrevious={() => setOrdersPage((current) => Math.max(1, current - 1))}
              onNext={() => setOrdersPage((current) => Math.min(ordersMeta.total_pages ?? current, current + 1))}
              onGoto={(target) => setOrdersPage(target)}
            />
          </div>
        ) : null}

        {activeTab === "payments" ? (
          <div>
            <div className="bg-[#1a3557] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.8px] text-[#90caf9]">
              <i className="fas fa-money-bill-wave mr-1.5" />
              Payment History
            </div>

            <div className="overflow-x-auto">
              <table className="erp-table w-full min-w-[760px]">
                <thead>
                  <tr>
                    <th>Payment #</th>
                    <th>Date</th>
                    <th>Method</th>
                    <th>Reference</th>
                    <th>Amount</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isPaymentsLoading ? (
                    <TableEmptyState colSpan={6} message="Loading payment history..." />
                  ) : payments.length === 0 ? (
                    <TableEmptyState colSpan={6} message="No customer payments recorded yet." />
                  ) : (
                    payments.map((payment) => (
                      <tr key={payment.id}>
                        <td className="font-mono text-[#1a3557]">{payment.payment_number}</td>
                        <td>{formatDate(payment.date)}</td>
                        <td>{humanizeStatus(payment.payment_method)}</td>
                        <td>{payment.reference_number || "—"}</td>
                        <td className="font-bold text-[#1a3557]">{formatMoney(payment.amount)}</td>
                        <td>
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => setAllocationPayment(payment)}
                              className="erp-icon-button-md"
                              title="View payment allocations"
                            >
                              <i className="fas fa-sitemap text-[11px]" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedPayment(payment)}
                              className="erp-icon-button-md"
                              title="View proof image"
                              disabled={!payment.proof_image_url}
                            >
                              <i className="fas fa-image text-[11px]" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={paymentsMeta.current_page ?? 1}
              lastPage={paymentsMeta.total_pages ?? 1}
              perPage={paymentsMeta.per_page ?? 10}
              total={paymentsMeta.total ?? 0}
              itemLabel="payments"
              loading={isPaymentsFetching}
              onPrevious={() => setPaymentsPage((current) => Math.max(1, current - 1))}
              onNext={() => setPaymentsPage((current) => Math.min(paymentsMeta.total_pages ?? current, current + 1))}
              onGoto={(target) => setPaymentsPage(target)}
            />
          </div>
        ) : null}

        {activeTab === "returns" ? (
          <div>
            <div className="bg-[#1a3557] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.8px] text-[#90caf9]">
              <i className="fas fa-undo mr-1.5" />
              Return History
            </div>

            <div className="overflow-x-auto">
              <table className="erp-table w-full min-w-[640px]">
                <thead>
                  <tr>
                    <th>RMA #</th>
                    <th>Date</th>
                    <th>Reason</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {isReturnsLoading ? (
                    <TableEmptyState colSpan={5} message="Loading return records..." />
                  ) : returns.length === 0 ? (
                    <TableEmptyState colSpan={5} message="No completed returns found for this customer." />
                  ) : (
                    returns.map((entry) => (
                      <tr key={entry.id}>
                        <td className="font-mono text-[#1a3557]">{entry.return_number}</td>
                        <td>{formatDate(entry.return_date)}</td>
                        <td>{entry.reason}</td>
                        <td>{formatMoney(entry.total_amount)}</td>
                        <td>
                          <span className={`rounded-sm border px-1.5 py-0.5 text-[9px] font-bold uppercase ${getBadgeClasses(entry.status)}`}>
                            {humanizeStatus(entry.status)}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={returnsMeta.current_page ?? 1}
              lastPage={returnsMeta.total_pages ?? 1}
              perPage={returnsMeta.per_page ?? 10}
              total={returnsMeta.total ?? 0}
              itemLabel="returns"
              loading={isReturnsFetching}
              onPrevious={() => setReturnsPage((current) => Math.max(1, current - 1))}
              onNext={() => setReturnsPage((current) => Math.min(returnsMeta.total_pages ?? current, current + 1))}
              onGoto={(target) => setReturnsPage(target)}
            />
          </div>
        ) : null}
      </section>
        </div>
      </section>

      <FormModal show={showPaymentModal} title="Record Customer Payment" size="3xl" onClose={closePaymentModal}>
        <form onSubmit={handleRecordPayment} className="space-y-5">
          <div className="flex items-center justify-between rounded-sm border border-[#2c5f8a] bg-[#0070b8] px-4 py-3 text-white">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.5px] text-[#90caf9]">Total Outstanding</div>
              <div className="mt-1 font-mono text-[22px] font-extrabold">{formatMoney(unpaidSummary.total_outstanding)}</div>
            </div>
            <div className="text-right text-[11px] text-[#d9edf9]">
              <div className="font-bold">{unpaidOrders.length} unpaid order(s)</div>
              <div>Attach proof to scan and autofill fields.</div>
            </div>
          </div>

          <div>
            <label className="erp-label">
              Upload Payment Proof And Scan <span className="text-[#c62828]">*</span>
            </label>
            <label
              className={`mt-1 block overflow-hidden rounded-sm border-2 border-dashed bg-[#f9fafc] transition-colors ${
                paymentForm.proofPreviewUrl
                  ? "border-[#0070b8]"
                  : "border-[#b0bec5] hover:border-[#0070b8] cursor-pointer"
              }`}
            >
              <input
                key={proofInputKey}
                type="file"
                accept="image/*"
                onChange={handleProofFileChange}
                className="sr-only"
              />

              {!paymentForm.proofPreviewUrl ? (
                <div className="flex flex-col items-center gap-1.5 p-8 text-center">
                  <i className="fas fa-cloud-upload-alt text-[28px] text-[#90a4ae]" />
                  <div className="text-[12px] font-bold text-[#546e7a]">Click to upload image</div>
                  <div className="text-[10px] text-[#90a4ae]">PNG, JPG, JPEG, WEBP · Max 5MB</div>
                </div>
              ) : (
                <div className="relative h-[220px] w-full bg-white">
                  <img src={paymentForm.proofPreviewUrl} alt="Payment proof preview" className="h-full w-full object-contain" />
                  {scanReceiptMutation.isPending ? (
                    <div className="absolute inset-0 overflow-hidden bg-[#17324d]/18 pointer-events-none">
                      <div className="scan-laser" />
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      handleRemoveProof();
                    }}
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[#c62828] text-white shadow-[0_6px_16px_rgba(198,40,40,0.35)]"
                    title="Remove proof image"
                  >
                    <i className="fas fa-times text-[11px]" />
                  </button>
                  {!scanReceiptMutation.isPending ? (
                    <div className="absolute inset-x-0 bottom-0 bg-black/45 px-3 py-1.5 text-center text-[10px] text-white">
                      {paymentForm.proofName}
                    </div>
                  ) : null}
                </div>
              )}
            </label>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
              <span className="rounded-sm border border-[#dce5ec] bg-[#f8fbfd] px-2 py-1 font-bold uppercase tracking-[0.4px] text-[#607d8b]">
                {paymentForm.proofFile ? "Proof attached" : "Awaiting image"}
              </span>
              {scanReceiptMutation.isPending ? (
                <span className="text-[#0070b8]">OCR is scanning the image and will autofill amount, reference, and date.</span>
              ) : paymentForm.proofFile ? (
                <span className="text-[#546e7a]">Autofilled values can still be adjusted before recording payment.</span>
              ) : (
                <span className="text-[#546e7a]">Attach the receipt or cheque image first to mimic the Vue payment flow.</span>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="erp-label">
                Payment Date <span className="text-[#c62828]">*</span>
              </label>
              <input
                type="date"
                max={formatDateInput(new Date())}
                value={paymentForm.date}
                onChange={(event) => handlePaymentFieldChange("date", event.target.value)}
                className="erp-input"
              />
            </div>
            <div>
              <label className="erp-label">
                Amount Received <span className="text-[#c62828]">*</span>
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] font-bold text-[#546e7a]">
                  ₱
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={paymentForm.amount}
                  onChange={(event) => handlePaymentFieldChange("amount", event.target.value)}
                  className="erp-input pl-7"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="erp-label">
                Payment Method <span className="text-[#c62828]">*</span>
              </label>
              <select
                value={paymentForm.paymentMethod}
                onChange={(event) => handlePaymentFieldChange("paymentMethod", event.target.value)}
                className="erp-select"
              >
                <option value="">Select payment method</option>
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
                value={paymentForm.referenceNumber}
                onChange={(event) => handlePaymentFieldChange("referenceNumber", event.target.value)}
                className="erp-input"
                placeholder="Cheque no. / transfer ref."
              />
            </div>
          </div>

          <div>
            <label className="erp-label">Notes</label>
            <textarea
              value={paymentForm.notes}
              onChange={(event) => handlePaymentFieldChange("notes", event.target.value)}
              className="erp-input min-h-[84px]"
              placeholder="Additional payment notes..."
            />
          </div>

          {Number(paymentForm.amount) > 0 && allocationPreview.length > 0 ? (
            <div className="overflow-hidden rounded-sm border border-[#d3e1ea]">
              <div className="flex items-center justify-between bg-[#1a3557] px-4 py-2">
                <div className="text-[10px] font-bold uppercase tracking-[0.8px] text-[#90caf9]">
                  <i className="fas fa-link mr-1.5" />
                  Auto Allocation Preview
                </div>
                <div className="text-[10px] text-[#b3d4f0]">Oldest First</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse">
                  <thead>
                    <tr>
                      <th className="border-r border-[#4a7fa8] bg-[#2c5f8a] px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.3px] text-white">Order #</th>
                      <th className="border-r border-[#4a7fa8] bg-[#2c5f8a] px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.3px] text-white">Date</th>
                      <th className="border-r border-[#4a7fa8] bg-[#2c5f8a] px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.3px] text-white">Due Date</th>
                      <th className="border-r border-[#4a7fa8] bg-[#2c5f8a] px-3 py-2 text-right text-[10px] font-bold uppercase tracking-[0.3px] text-white">Balance</th>
                      <th className="border-r border-[#4a7fa8] bg-[#2c5f8a] px-3 py-2 text-right text-[10px] font-bold uppercase tracking-[0.3px] text-white">Payment</th>
                      <th className="bg-[#2c5f8a] px-3 py-2 text-right text-[10px] font-bold uppercase tracking-[0.3px] text-white">Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allocationPreview.map((allocation) => (
                      <tr key={allocation.orderId} className={allocation.isOverdue ? "bg-[#fff5f5]" : "bg-white"}>
                        <td className="border-b border-r border-[#dde3e8] px-3 py-2 text-[12px]">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-[#1a3557]">{allocation.orderNumber}</span>
                            {allocation.isOverdue ? (
                              <span className="rounded-sm bg-[#c62828] px-1.5 py-0.5 text-[8px] font-bold tracking-[0.5px] text-white">
                                OVERDUE
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="border-b border-r border-[#dde3e8] px-3 py-2 text-[11px] text-[#90a4ae]">
                          {formatDate(allocation.invoiceDate)}
                        </td>
                        <td className={`border-b border-r border-[#dde3e8] px-3 py-2 text-[11px] font-mono ${allocation.isOverdue ? "font-bold text-[#c62828]" : "text-[#90a4ae]"}`}>
                          {formatDate(allocation.dueDate)}
                        </td>
                        <td className="border-b border-r border-[#dde3e8] px-3 py-2 text-right font-mono text-[11px] text-[#1a3557]">
                          {formatMoney(allocation.balance)}
                        </td>
                        <td className="border-b border-r border-[#dde3e8] px-3 py-2 text-right font-mono text-[11px] font-bold text-[#2e7d32]">
                          {formatMoney(allocation.payment)}
                        </td>
                        <td className={`border-b border-[#dde3e8] px-3 py-2 text-right font-mono text-[11px] font-bold ${allocation.remaining === 0 ? "text-[#2e7d32]" : "text-[#e65100]"}`}>
                          {formatMoney(allocation.remaining)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {excessAmount > 0 ? (
                <div className="m-3 flex items-start gap-2.5 rounded-sm border border-[#90caf9] bg-[#e8f1f8] px-3 py-2.5">
                  <i className="fas fa-info-circle mt-0.5 text-[14px] text-[#0070b8]" />
                  <div>
                    <div className="text-[12px] font-bold text-[#212121]">Excess Payment</div>
                    <div className="text-[11px] text-[#546e7a]">
                      {formatMoney(excessAmount)} will be credited as advance payment for future orders.
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-2 border-t border-[#dce5ec] pt-4">
            <button type="button" onClick={closePaymentModal} className="erp-header-secondary-button">
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-sm bg-[#2e7d32] px-3.5 py-1.5 text-[12px] font-bold text-white transition-colors hover:bg-[#1b5e20] disabled:cursor-not-allowed disabled:bg-[#b0bec5]"
              disabled={isPaymentSubmitDisabled}
            >
              <i className={`fas ${recordPaymentMutation.isPending ? "fa-spinner animate-spin" : "fa-check"}`} />
              {recordPaymentMutation.isPending ? "Recording..." : "Record Payment"}
            </button>
          </div>
        </form>
      </FormModal>

      <FormModal show={showStatementModal} title="Generate Statement of Account" size="lg" onClose={() => setShowStatementModal(false)}>
        <div className="space-y-4">
          <p className="text-[11px] text-[#546e7a]">
            Leave the date range as-is to generate the current month statement, or choose a custom period.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="erp-label">From</label>
              <input
                type="date"
                value={statementFilters.from}
                onChange={(event) => setStatementFilters((current) => ({ ...current, from: event.target.value }))}
                className="erp-input"
              />
            </div>
            <div>
              <label className="erp-label">To</label>
              <input
                type="date"
                value={statementFilters.to}
                onChange={(event) => setStatementFilters((current) => ({ ...current, to: event.target.value }))}
                className="erp-input"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[#dce5ec] pt-4">
            <button type="button" onClick={() => setShowStatementModal(false)} className="erp-header-secondary-button">
              Cancel
            </button>
            <button type="button" onClick={handleDownloadStatement} className="erp-header-primary-button">
              Download PDF
            </button>
          </div>
        </div>
      </FormModal>

      <FormModal
        show={Boolean(selectedPayment)}
        title=""
        size="max-w-[700px]"
        hideHeader
        bodyClassName="p-0"
        panelClassName="overflow-hidden bg-white shadow-2xl"
        onClose={() => setSelectedPayment(null)}
      >
        {selectedPayment ? (
          <div className="flex min-h-[400px] flex-col md:flex-row">
            <div className="flex flex-1 flex-col border-r border-[#f1f1f1]">
              <div className="flex items-center gap-3 bg-[#0070b8] px-4 py-3.5">
                <i className="fas fa-receipt text-[18px] text-white" />
                <div className="text-[14px] font-bold uppercase tracking-wider text-white">Proof of Payment</div>
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                <div className="flex flex-col gap-3.5">
                  <div>
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[#90a4ae]">
                      Transaction Ref
                    </div>
                    <div className="text-[13px] font-mono font-bold text-[#1a3557]">
                      {selectedPayment.payment_number}
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[#90a4ae]">
                      Amount Paid
                    </div>
                    <div className="text-[20px] font-mono font-bold text-[#2e7d32]">
                      {formatMoney(selectedPayment.amount)}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[#90a4ae]">
                        Date
                      </div>
                      <div className="text-[12px] text-[#1a3557]">{formatDate(selectedPayment.date)}</div>
                    </div>
                    <div>
                      <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[#90a4ae]">
                        Method
                      </div>
                      <div
                        className={`inline-flex items-center gap-1 rounded-sm border px-2 py-1 text-[10px] font-bold ${getPaymentMethodBadgeClasses(selectedPayment.payment_method)}`}
                      >
                        <i className={getPaymentMethodIcon(selectedPayment.payment_method)} />
                        {humanizeStatus(selectedPayment.payment_method)}
                      </div>
                    </div>
                  </div>

                  {selectedPayment.reference_number ? (
                    <div>
                      <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[#90a4ae]">
                        External Ref #
                      </div>
                      <div className="text-[12px] font-mono text-[#1a3557]">
                        {selectedPayment.reference_number}
                      </div>
                    </div>
                  ) : null}

                  {(selectedPayment.allocations ?? []).length > 0 ? (
                    <div className="mt-2 border-t border-dashed border-[#dde3e8] pt-4">
                      <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#90a4ae]">
                        Allocated To
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {selectedPayment.allocations.map((allocation) => (
                          <div
                            key={allocation.id}
                            className="flex items-center justify-between rounded-sm border border-[#e2e8f0] bg-[#f8fafc] px-2.5 py-1.5"
                          >
                            <span className="text-[11px] font-mono font-bold text-[#1a3557]">
                              {allocation.invoice_number || allocation.order_number || "Opening Balance"}
                            </span>
                            <span className="text-[11px] font-mono font-bold text-[#2e7d32]">
                              {formatMoney(allocation.allocated_amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex justify-end border-t border-gray-100 bg-[#f9fafb] p-4">
                <button
                  type="button"
                  onClick={() => setSelectedPayment(null)}
                  className="rounded-sm bg-[#1a3557] px-5 py-2 text-[12px] font-bold text-white transition-all hover:bg-[#2c5f8a]"
                >
                  Close Viewer
                </button>
              </div>
            </div>

            <div className="flex w-full items-center justify-center bg-[#1a3557] p-4 md:w-[320px]">
              <div className="group relative flex h-full w-full items-center justify-center overflow-hidden rounded-md border border-white/10 bg-white/5">
                {selectedPayment.proof_image_url ? (
                  <img
                    src={selectedPayment.proof_image_url}
                    alt="Payment proof"
                    className="max-h-[450px] max-w-full object-contain transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="px-4 text-center text-[11px] italic text-white/70">
                    No proof image available for this payment.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </FormModal>

      <FormModal
        show={Boolean(allocationPayment)}
        title={`Payment Allocations${allocationPayment?.payment_number ? ` · ${allocationPayment.payment_number}` : ""}`}
        size="2xl"
        onClose={() => setAllocationPayment(null)}
      >
        {allocationPayment ? (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.5px] text-[#607d8b]">Amount</div>
                <div className="mt-1 text-[12px] font-bold text-[#1a3557]">{formatMoney(allocationPayment.amount)}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.5px] text-[#607d8b]">Date</div>
                <div className="mt-1 text-[12px] font-bold text-[#1a3557]">{formatDate(allocationPayment.date)}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.5px] text-[#607d8b]">Method</div>
                <div className="mt-1 text-[12px] font-bold text-[#1a3557]">{humanizeStatus(allocationPayment.payment_method)}</div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="erp-table w-full min-w-[640px]">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Order #</th>
                    <th>Allocated Amount</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {(allocationPayment.allocations ?? []).length === 0 ? (
                    <TableEmptyState colSpan={4} message="No allocations found for this payment." />
                  ) : (
                    allocationPayment.allocations.map((allocation) => (
                      <tr key={allocation.id}>
                        <td className="font-mono text-[#1a3557]">{allocation.invoice_number || "Opening Balance"}</td>
                        <td>{allocation.order_number || "—"}</td>
                        <td>{formatMoney(allocation.allocated_amount)}</td>
                        <td>{formatDate(allocation.created_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </FormModal>
    </div>
  );
}
