import { useDeferredValue, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { ConfirmationModal } from "@/shared/components/common/ConfirmationModal";
import { DateField } from "@/shared/components/common/DateField";
import { DateRangeField } from "@/shared/components/common/DateRangeField";
import { FormModal } from "@/shared/components/common/FormModal";
import { Pagination } from "@/shared/components/common/Pagination";
import { SearchableSelect } from "@/shared/components/common/SearchableSelect";
import { Skeleton, TableSkeleton } from "@/shared/components/common/Skeleton";
import { useNotification } from "@/shared/hooks/useNotification";
import {
  createBusinessExpense,
  createRecurringBusinessExpense,
  deleteBusinessExpense,
  deleteRecurringBusinessExpense,
  getBusinessExpenses,
  getBusinessExpenseSummary,
  getExpenseCategories,
  getRecurringBusinessExpenses,
  updateBusinessExpense,
  updateRecurringBusinessExpense
} from "@/modules/expenses/api/business-expenses.api";

const expenseTabOptions = [
  { value: "manual", label: "Manual Entries", icon: "fas fa-hand-holding-dollar" },
  { value: "recurring", label: "Recurring Schedules", icon: "fas fa-rotate" }
];

const expenseStatusOptions = [
  { value: "", label: "All Status" },
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "void", label: "Void" }
];

const recurringFrequencyOptions = [
  { value: "", label: "All Frequency" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "annually", label: "Annually" }
];

const paymentMethodOptions = [
  { value: "", label: "All Methods" },
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "credit_card", label: "Credit Card" },
  { value: "other", label: "Other" }
];

const activeStatusOptions = [
  { value: "", label: "All Schedule Status" },
  { value: "true", label: "Active" },
  { value: "false", label: "Paused" }
];

const weekdayOptions = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" }
];

const monthOptions = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" }
];

const manualExpenseDefaultValues = {
  categoryId: "",
  amount: "",
  expenseDate: "",
  description: "",
  payee: "",
  paymentMethod: "cash",
  referenceNumber: "",
  attachmentUrl: "",
  status: "paid"
};

const recurringExpenseDefaultValues = {
  categoryId: "",
  amount: "",
  description: "",
  payee: "",
  paymentMethod: "cash",
  frequency: "monthly",
  dayOfMonth: "",
  dayOfWeek: "",
  monthOfYear: "",
  isActive: true
};

function optionalMonthDayField() {
  return z.preprocess((value) => {
    if (value === "" || value === null || value === undefined) {
      return undefined;
    }
    return value;
  }, z.coerce.number().int().min(1).max(31).optional());
}

function optionalWeekdayField() {
  return z.preprocess((value) => {
    if (value === "" || value === null || value === undefined) {
      return undefined;
    }
    return value;
  }, z.coerce.number().int().min(0).max(6).optional());
}

function optionalMonthField() {
  return z.preprocess((value) => {
    if (value === "" || value === null || value === undefined) {
      return undefined;
    }
    return value;
  }, z.coerce.number().int().min(1).max(12).optional());
}

const manualExpenseSchema = z.object({
  categoryId: z.coerce.number().int().positive("Category is required"),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  expenseDate: z.string().trim().min(1, "Expense date is required"),
  description: z.string().trim().max(5000, "Description is too long").optional(),
  payee: z.string().trim().max(255, "Payee is too long").optional(),
  paymentMethod: z.enum(["cash", "cheque", "bank_transfer", "credit_card", "other"]),
  referenceNumber: z.string().trim().max(100, "Reference number is too long").optional(),
  attachmentUrl: z.union([z.string().trim().url("Attachment URL must be valid"), z.literal("")]).optional(),
  status: z.enum(["draft", "pending", "paid", "void"])
});

const recurringExpenseSchema = z.object({
  categoryId: z.coerce.number().int().positive("Category is required"),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  description: z.string().trim().max(5000, "Description is too long").optional(),
  payee: z.string().trim().max(255, "Payee is too long").optional(),
  paymentMethod: z.enum(["cash", "cheque", "bank_transfer", "credit_card", "other"]),
  frequency: z.enum(["daily", "weekly", "monthly", "annually"]),
  dayOfMonth: optionalMonthDayField(),
  dayOfWeek: optionalWeekdayField(),
  monthOfYear: optionalMonthField(),
  isActive: z.boolean()
}).superRefine((value, ctx) => {
  if (value.frequency === "monthly" && value.dayOfMonth === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["dayOfMonth"],
      message: "Day of month is required for monthly schedules"
    });
  }

  if (value.frequency === "weekly" && value.dayOfWeek === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["dayOfWeek"],
      message: "Weekday is required for weekly schedules"
    });
  }

  if (value.frequency === "annually") {
    if (value.monthOfYear === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["monthOfYear"],
        message: "Month is required for annual schedules"
      });
    }
    if (value.dayOfMonth === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dayOfMonth"],
        message: "Day of month is required for annual schedules"
      });
    }
  }
});

function formatCurrency(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function getTodayDateValue() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(value) {
  if (!value) {
    return null;
  }

  const [year, month, day] = String(value).split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function formatDateValue(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function formatPaymentMethod(value) {
  const labels = {
    cash: "Cash",
    cheque: "Cheque",
    bank_transfer: "Bank Transfer",
    credit_card: "Credit Card",
    other: "Other"
  };

  return labels[value] ?? value ?? "N/A";
}

function formatExpenseStatus(value) {
  if (!value) {
    return "Unknown";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatSchedule(recurring) {
  if (!recurring) {
    return "N/A";
  }

  if (recurring.frequency === "daily") {
    return "Daily";
  }

  if (recurring.frequency === "weekly") {
    const weekday = weekdayOptions.find((option) => option.value === Number(recurring.dayOfWeek));
    return weekday ? `Every ${weekday.label}` : "Weekly";
  }

  if (recurring.frequency === "monthly") {
    return recurring.dayOfMonth ? `Monthly on day ${recurring.dayOfMonth}` : "Monthly";
  }

  if (recurring.frequency === "annually") {
    const month = monthOptions.find((option) => option.value === Number(recurring.monthOfYear));
    if (month && recurring.dayOfMonth) {
      return `Every ${month.label} ${recurring.dayOfMonth}`;
    }
    return "Annually";
  }

  return recurring.frequency;
}

function expenseStatusBadgeClass(status) {
  const styles = {
    draft: "border-[#c8d3db] bg-[#f8fafb] text-[#5f7283]",
    pending: "border-[#efd79a] bg-[#fff9ec] text-[#9a6a00]",
    paid: "border-[#c2ddbe] bg-[#f3faf1] text-[#356b37]",
    void: "border-[#efb0b0] bg-[#fff3f3] text-[#a64545]"
  };

  return styles[status] ?? styles.draft;
}

function scheduleStatusBadgeClass(isActive) {
  return isActive
    ? "border-[#c2ddbe] bg-[#f3faf1] text-[#356b37]"
    : "border-[#c8d3db] bg-[#f8fafb] text-[#5f7283]";
}

function flattenCategories(items, prefix = "") {
  const entries = [];

  for (const item of items ?? []) {
    entries.push({
      value: item.id,
      label: prefix ? `${prefix} / ${item.name}` : item.name
    });

    if (item.children?.length) {
      entries.push(...flattenCategories(item.children, prefix ? `${prefix} / ${item.name}` : item.name));
    }
  }

  return entries;
}

function SummaryStat({ label, value, helper = null, loading = false }) {
  return (
    <article className="rounded-sm border border-[#d7e3ea] bg-white px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#78909c]">{label}</p>
      {loading ? <Skeleton className="mt-2 h-5 w-24" /> : <p className="mt-2 text-[18px] font-bold text-[#1a3557]">{value}</p>}
      {helper ? <p className="mt-1 truncate text-[10px] text-[#90a4ae]">{helper}</p> : null}
    </article>
  );
}

export function BusinessExpensesPage() {
  const [activeTab, setActiveTab] = useState("manual");
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [frequencyFilter, setFrequencyFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showRecurringForm, setShowRecurringForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [editingRecurring, setEditingRecurring] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const deferredSearch = useDeferredValue(searchInput.trim());
  const queryClient = useQueryClient();
  const notify = useNotification();

  const {
    register: registerExpense,
    handleSubmit: handleExpenseSubmit,
    reset: resetExpenseForm,
    control: expenseControl,
    formState: { errors: expenseErrors, isSubmitting: expenseSubmitting }
  } = useForm({
    resolver: zodResolver(manualExpenseSchema),
    defaultValues: manualExpenseDefaultValues
  });

  const {
    register: registerRecurring,
    handleSubmit: handleRecurringSubmit,
    reset: resetRecurringForm,
    control: recurringControl,
    watch: watchRecurring,
    formState: { errors: recurringErrors, isSubmitting: recurringSubmitting }
  } = useForm({
    resolver: zodResolver(recurringExpenseSchema),
    defaultValues: recurringExpenseDefaultValues
  });

  const recurringFrequency = watchRecurring("frequency");

  const categoriesQuery = useQuery({
    queryKey: ["business-expenses", "categories"],
    queryFn: getExpenseCategories
  });

  const summaryQuery = useQuery({
    queryKey: ["business-expenses", "summary"],
    queryFn: getBusinessExpenseSummary
  });

  const expensesQuery = useQuery({
    queryKey: ["business-expenses", "manual", page, deferredSearch, categoryFilter, statusFilter, dateFrom, dateTo],
    queryFn: () => getBusinessExpenses({
      page,
      perPage: 15,
      ...(deferredSearch ? { search: deferredSearch } : {}),
      ...(categoryFilter ? { categoryId: categoryFilter } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {})
    }),
    placeholderData: keepPreviousData
  });

  const recurringQuery = useQuery({
    queryKey: ["business-expenses", "recurring", deferredSearch, categoryFilter, frequencyFilter, activeFilter],
    queryFn: () => getRecurringBusinessExpenses({
      ...(deferredSearch ? { search: deferredSearch } : {}),
      ...(categoryFilter ? { categoryId: categoryFilter } : {}),
      ...(frequencyFilter ? { frequency: frequencyFilter } : {}),
      ...(activeFilter ? { isActive: activeFilter } : {})
    })
  });

  const createExpenseMutation = useMutation({
    mutationFn: createBusinessExpense,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["business-expenses", "manual"] }),
        queryClient.invalidateQueries({ queryKey: ["business-expenses", "summary"] })
      ]);
      notify.success("Business expense recorded successfully");
      resetExpenseForm(manualExpenseDefaultValues);
      setEditingExpense(null);
      setShowExpenseForm(false);
      setPage(1);
    }
  });

  const updateExpenseMutation = useMutation({
    mutationFn: ({ id, payload }) => updateBusinessExpense(id, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["business-expenses", "manual"] }),
        queryClient.invalidateQueries({ queryKey: ["business-expenses", "summary"] })
      ]);
      notify.success("Business expense updated successfully");
      resetExpenseForm(manualExpenseDefaultValues);
      setEditingExpense(null);
      setShowExpenseForm(false);
    }
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: deleteBusinessExpense,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["business-expenses", "manual"] }),
        queryClient.invalidateQueries({ queryKey: ["business-expenses", "summary"] })
      ]);
      notify.success("Business expense deleted successfully");
      setDeleteTarget(null);
    }
  });

  const createRecurringMutation = useMutation({
    mutationFn: createRecurringBusinessExpense,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["business-expenses", "recurring"] }),
        queryClient.invalidateQueries({ queryKey: ["business-expenses", "summary"] })
      ]);
      notify.success("Recurring expense created successfully");
      resetRecurringForm(recurringExpenseDefaultValues);
      setEditingRecurring(null);
      setShowRecurringForm(false);
    }
  });

  const updateRecurringMutation = useMutation({
    mutationFn: ({ id, payload }) => updateRecurringBusinessExpense(id, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["business-expenses", "recurring"] }),
        queryClient.invalidateQueries({ queryKey: ["business-expenses", "summary"] })
      ]);
      notify.success("Recurring expense updated successfully");
      resetRecurringForm(recurringExpenseDefaultValues);
      setEditingRecurring(null);
      setShowRecurringForm(false);
    }
  });

  const deleteRecurringMutation = useMutation({
    mutationFn: deleteRecurringBusinessExpense,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["business-expenses", "recurring"] }),
        queryClient.invalidateQueries({ queryKey: ["business-expenses", "summary"] })
      ]);
      notify.success("Recurring expense deleted successfully");
      setDeleteTarget(null);
    }
  });

  const categories = categoriesQuery.data?.data ?? [];
  const categoryOptions = flattenCategories(categories);
  const summary = summaryQuery.data?.data;
  const expenses = expensesQuery.data?.data ?? [];
  const expenseMeta = expensesQuery.data?.meta;
  const recurringExpenses = recurringQuery.data?.data ?? [];

  function clearFilters() {
    setPage(1);
    setSearchInput("");
    setCategoryFilter("");
    setStatusFilter("");
    setDateFrom("");
    setDateTo("");
    setFrequencyFilter("");
    setActiveFilter("");
  }

  function openCreateExpenseForm() {
    resetExpenseForm({
      ...manualExpenseDefaultValues,
      expenseDate: getTodayDateValue()
    });
    setEditingExpense(null);
    setShowExpenseForm(true);
  }

  function openEditExpenseForm(expense) {
    resetExpenseForm({
      categoryId: expense.categoryId,
      amount: expense.amount,
      expenseDate: expense.expenseDate ? String(expense.expenseDate).slice(0, 10) : "",
      description: expense.description ?? "",
      payee: expense.payee ?? "",
      paymentMethod: expense.paymentMethod ?? "cash",
      referenceNumber: expense.referenceNumber ?? "",
      attachmentUrl: expense.attachmentUrl ?? "",
      status: expense.status ?? "paid"
    });
    setEditingExpense(expense);
    setShowExpenseForm(true);
  }

  function closeExpenseForm() {
    resetExpenseForm(manualExpenseDefaultValues);
    setEditingExpense(null);
    setShowExpenseForm(false);
  }

  function openCreateRecurringForm() {
    resetRecurringForm(recurringExpenseDefaultValues);
    setEditingRecurring(null);
    setShowRecurringForm(true);
  }

  function openEditRecurringForm(recurring) {
    resetRecurringForm({
      categoryId: recurring.categoryId,
      amount: recurring.amount,
      description: recurring.description ?? "",
      payee: recurring.payee ?? "",
      paymentMethod: recurring.paymentMethod ?? "cash",
      frequency: recurring.frequency ?? "monthly",
      dayOfMonth: recurring.dayOfMonth ?? "",
      dayOfWeek: recurring.dayOfWeek ?? "",
      monthOfYear: recurring.monthOfYear ?? "",
      isActive: Boolean(recurring.isActive)
    });
    setEditingRecurring(recurring);
    setShowRecurringForm(true);
  }

  function closeRecurringForm() {
    resetRecurringForm(recurringExpenseDefaultValues);
    setEditingRecurring(null);
    setShowRecurringForm(false);
  }

  async function submitExpense(values) {
    const payload = {
      categoryId: Number(values.categoryId),
      amount: Number(values.amount),
      expenseDate: values.expenseDate,
      description: values.description?.trim() || null,
      payee: values.payee?.trim() || null,
      paymentMethod: values.paymentMethod,
      referenceNumber: values.referenceNumber?.trim() || null,
      attachmentUrl: values.attachmentUrl?.trim() || null,
      status: values.status
    };

    if (editingExpense) {
      await updateExpenseMutation.mutateAsync({
        id: editingExpense.id,
        payload
      });
      return;
    }

    await createExpenseMutation.mutateAsync(payload);
  }

  async function submitRecurring(values) {
    const payload = {
      categoryId: Number(values.categoryId),
      amount: Number(values.amount),
      description: values.description?.trim() || null,
      payee: values.payee?.trim() || null,
      paymentMethod: values.paymentMethod,
      frequency: values.frequency,
      dayOfMonth: values.dayOfMonth === "" || values.dayOfMonth == null ? undefined : Number(values.dayOfMonth),
      dayOfWeek: values.dayOfWeek === "" || values.dayOfWeek == null ? undefined : Number(values.dayOfWeek),
      monthOfYear: values.monthOfYear === "" || values.monthOfYear == null ? undefined : Number(values.monthOfYear),
      isActive: Boolean(values.isActive)
    };

    if (editingRecurring) {
      await updateRecurringMutation.mutateAsync({
        id: editingRecurring.id,
        payload
      });
      return;
    }

    await createRecurringMutation.mutateAsync(payload);
  }

  async function confirmDelete() {
    if (!deleteTarget) {
      return;
    }

    if (deleteTarget.type === "manual") {
      await deleteExpenseMutation.mutateAsync(deleteTarget.item.id);
      return;
    }

    await deleteRecurringMutation.mutateAsync(deleteTarget.item.id);
  }

  const expenseFormBusy = expenseSubmitting || createExpenseMutation.isPending || updateExpenseMutation.isPending;
  const recurringFormBusy = recurringSubmitting || createRecurringMutation.isPending || updateRecurringMutation.isPending;
  const manualErrorMessage = updateExpenseMutation.error?.response?.data?.message ?? createExpenseMutation.error?.response?.data?.message;
  const recurringErrorMessage = updateRecurringMutation.error?.response?.data?.message ?? createRecurringMutation.error?.response?.data?.message;

  return (
    <div className="space-y-4">
      <section className="erp-page-section erp-page-section-joined">
        <div className="erp-page-header">
          <div className="flex items-center gap-3">
            <i className="fas fa-receipt text-[18px] text-[#90caf9]" />
            <div>
              <div className="erp-page-title">Business Expenses</div>
              <div className="erp-page-description">Track operating overhead, recurring commitments, and non-inventory spending in one finance workspace.</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={activeTab === "manual" ? openCreateExpenseForm : openCreateRecurringForm}
              className="erp-header-primary-button"
            >
              <i className="fas fa-plus mr-1.5" />
              {activeTab === "manual" ? "Record Expense" : "Add Schedule"}
            </button>
          </div>
        </div>
      </section>

      <section className="erp-page-main-card erp-page-main-card-joined space-y-4 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {expenseTabOptions.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={`inline-flex items-center gap-2 rounded-sm border px-3 py-2 text-[11px] font-bold uppercase tracking-[0.6px] transition-colors ${
                  activeTab === tab.value
                    ? "border-[#1a3557] bg-[#1a3557] text-white"
                    : "border-[#c9d6e2] bg-white text-[#546e7a] hover:border-[#0070b8] hover:text-[#0070b8]"
                }`}
              >
                <i className={`${tab.icon} text-[11px]`} />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[540px]">
            <SummaryStat
            label="This Week"
            value={formatCurrency(summary?.thisWeekTotal ?? 0)}
            helper="Paid expenses posted this week"
            loading={summaryQuery.isLoading}
          />
            <SummaryStat
            label="This Month"
            value={formatCurrency(summary?.thisMonthTotal ?? 0)}
            helper="Paid expenses posted this month"
            loading={summaryQuery.isLoading}
          />
            <SummaryStat
            label="Top Category"
            value={summary?.topCategories?.[0]?.category ?? "No data yet"}
            helper={summary?.topCategories?.[0] ? formatCurrency(summary.topCategories[0].total) : "No paid expenses yet this month"}
            loading={summaryQuery.isLoading}
          />
        </div>
        </div>

        <div className="rounded-sm border border-[#d7e3ea] bg-[#f9fbfe] p-2.5">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[11px] font-bold uppercase tracking-[0.4px] text-[#3f6786]">Filters</div>
            <button type="button" onClick={clearFilters} className="erp-filter-clear-button">
              <i className="fas fa-times mr-1" />
              Clear
            </button>
          </div>

          <div className="overflow-x-auto">
            <div className="flex min-w-max items-end gap-2.5">
            <div className={`relative ${activeTab === "manual" ? "w-[280px]" : "w-[320px]"}`}>
              <i className="fas fa-search pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#90a4ae]" />
              <input
                value={searchInput}
                onChange={(event) => {
                  setPage(1);
                  setSearchInput(event.target.value);
                }}
                placeholder={activeTab === "manual" ? "Search payee, reference, category..." : "Search recurring schedules..."}
                className="erp-input pl-7"
              />
            </div>

            <div className="w-[190px]">
              <select
                value={categoryFilter}
                onChange={(event) => {
                  setPage(1);
                  setCategoryFilter(event.target.value);
                }}
                className="erp-select"
              >
                <option value="">All Categories</option>
                {categoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {activeTab === "manual" ? (
              <>
                <div className="w-[150px]">
                  <select
                    value={statusFilter}
                    onChange={(event) => {
                      setPage(1);
                      setStatusFilter(event.target.value);
                    }}
                    className="erp-select"
                  >
                    {expenseStatusOptions.map((option) => (
                      <option key={option.value || "all"} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                    </select>
                </div>

                <div className="w-[320px]">
                  <DateRangeField
                    startValue={dateFrom}
                    endValue={dateTo}
                    onChange={({ start, end }) => {
                      setPage(1);
                      setDateFrom(start);
                      setDateTo(end);
                    }}
                    placeholder="Select date range"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="w-[160px]">
                  <select
                    value={frequencyFilter}
                    onChange={(event) => setFrequencyFilter(event.target.value)}
                    className="erp-select"
                  >
                    {recurringFrequencyOptions.map((option) => (
                      <option key={option.value || "all"} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                    </select>
                </div>

                <div className="w-[180px]">
                  <select
                    value={activeFilter}
                    onChange={(event) => setActiveFilter(event.target.value)}
                    className="erp-select"
                  >
                    {activeStatusOptions.map((option) => (
                      <option key={option.value || "all"} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                    </select>
                </div>
              </>
            )}
            </div>
          </div>
        </div>
      </section>

      {activeTab === "manual" ? (
        <section className="table-card erp-page-main-card-joined">
          {expensesQuery.isError ? (
            <div className="px-4 py-10 text-[11px] text-[#c62828]">
              Failed to load business expenses
              {expensesQuery.error?.message ? `: ${expensesQuery.error.message}` : "."}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className={`erp-table w-full min-w-[1080px] ${expensesQuery.isLoading ? "opacity-70" : ""}`}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Category</th>
                      <th>Description / Payee</th>
                      <th>Method</th>
                      <th>Status</th>
                      <th className="text-right">Amount</th>
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expensesQuery.isLoading ? (
                      <TableSkeleton rows={8}>
                        {(index) => (
                          <tr key={`expense-sk-${index}`}>
                            <td><Skeleton className="h-3 w-20" /></td>
                            <td><Skeleton className="h-3 w-28" /></td>
                            <td><Skeleton className="h-3 w-48" /></td>
                            <td><Skeleton className="h-3 w-24" /></td>
                            <td><Skeleton className="h-4 w-16" /></td>
                            <td><Skeleton className="ml-auto h-3 w-20" /></td>
                            <td><Skeleton className="mx-auto h-8 w-16" /></td>
                          </tr>
                        )}
                      </TableSkeleton>
                    ) : expenses.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-[11px] italic text-[#90a4ae]">
                          No business expenses found for the current filters.
                        </td>
                      </tr>
                    ) : (
                      expenses.map((expense) => (
                        <tr key={expense.id}>
                          <td>
                            <div className="font-semibold text-[#1a3557]">{formatDate(expense.expenseDate)}</div>
                          </td>
                          <td>
                            <div className="font-semibold text-[#1a3557]">{expense.category?.name ?? "N/A"}</div>
                            {expense.category?.parentName ? <div className="mt-1 text-[10px] text-[#90a4ae]">{expense.category.parentName}</div> : null}
                          </td>
                          <td>
                            <div className="font-semibold text-[#1a3557]">{expense.description || "No description"}</div>
                            <div className="mt-1 text-[10px] text-[#607d8b]">
                              {[expense.payee, expense.referenceNumber].filter(Boolean).join(" • ") || "No payee or reference"}
                            </div>
                          </td>
                          <td>{formatPaymentMethod(expense.paymentMethod)}</td>
                          <td>
                            <span className={`erp-status-badge ${expenseStatusBadgeClass(expense.status)}`}>
                              <span className="erp-status-badge-dot" />
                              {formatExpenseStatus(expense.status)}
                            </span>
                          </td>
                          <td className="text-right font-mono font-bold text-[#1a3557]">{formatCurrency(expense.amount)}</td>
                          <td>
                            <div className="flex items-center justify-center gap-2">
                              <button type="button" onClick={() => openEditExpenseForm(expense)} className="erp-icon-button-md" title="Edit expense">
                                <i className="fas fa-pen text-[11px]" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget({ type: "manual", item: expense })}
                                className="erp-icon-button-danger-md"
                                title="Delete expense"
                              >
                                <i className="fas fa-trash text-[11px]" />
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
                currentPage={expenseMeta?.page ?? 1}
                lastPage={expenseMeta?.totalPages ?? 1}
                perPage={expenseMeta?.limit ?? 15}
                total={expenseMeta?.total ?? 0}
                itemLabel="expenses"
                loading={expensesQuery.isFetching}
                onPrevious={() => setPage((current) => Math.max(1, current - 1))}
                onNext={() => setPage((current) => (expenseMeta?.totalPages ? Math.min(expenseMeta.totalPages, current + 1) : current + 1))}
                onGoto={(targetPage) => setPage(targetPage)}
              />
            </>
          )}
        </section>
      ) : (
        <section className="table-card erp-page-main-card-joined">
          {recurringQuery.isError ? (
            <div className="px-4 py-10 text-[11px] text-[#c62828]">
              Failed to load recurring expenses
              {recurringQuery.error?.message ? `: ${recurringQuery.error.message}` : "."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className={`erp-table w-full min-w-[980px] ${recurringQuery.isLoading ? "opacity-70" : ""}`}>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Description / Payee</th>
                    <th>Schedule</th>
                    <th>Next Run</th>
                    <th>Status</th>
                    <th className="text-right">Amount</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recurringQuery.isLoading ? (
                    <TableSkeleton rows={6}>
                      {(index) => (
                        <tr key={`recurring-sk-${index}`}>
                          <td><Skeleton className="h-3 w-28" /></td>
                          <td><Skeleton className="h-3 w-44" /></td>
                          <td><Skeleton className="h-3 w-24" /></td>
                          <td><Skeleton className="h-3 w-20" /></td>
                          <td><Skeleton className="h-4 w-16" /></td>
                          <td><Skeleton className="ml-auto h-3 w-20" /></td>
                          <td><Skeleton className="mx-auto h-8 w-16" /></td>
                        </tr>
                      )}
                    </TableSkeleton>
                  ) : recurringExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-[11px] italic text-[#90a4ae]">
                        No recurring schedules found for the current filters.
                      </td>
                    </tr>
                  ) : (
                    recurringExpenses.map((recurring) => (
                      <tr key={recurring.id}>
                        <td>
                          <div className="font-semibold text-[#1a3557]">{recurring.category?.name ?? "N/A"}</div>
                          {recurring.category?.parentName ? <div className="mt-1 text-[10px] text-[#90a4ae]">{recurring.category.parentName}</div> : null}
                        </td>
                        <td>
                          <div className="font-semibold text-[#1a3557]">{recurring.description || "No description"}</div>
                          <div className="mt-1 text-[10px] text-[#607d8b]">{recurring.payee || "No payee assigned"}</div>
                        </td>
                        <td>
                          <div className="font-semibold text-[#1a3557]">{formatSchedule(recurring)}</div>
                          <div className="mt-1 text-[10px] text-[#607d8b]">{formatPaymentMethod(recurring.paymentMethod)}</div>
                        </td>
                        <td>
                          <div className="font-semibold text-[#1a3557]">{formatDate(recurring.nextRunDate)}</div>
                          <div className="mt-1 text-[10px] text-[#90a4ae]">{recurring.generatedExpensesCount} generated</div>
                        </td>
                        <td>
                          <span className={`erp-status-badge ${scheduleStatusBadgeClass(recurring.isActive)}`}>
                            <span className="erp-status-badge-dot" />
                            {recurring.isActive ? "Active" : "Paused"}
                          </span>
                        </td>
                        <td className="text-right font-mono font-bold text-[#1a3557]">{formatCurrency(recurring.amount)}</td>
                        <td>
                          <div className="flex items-center justify-center gap-2">
                            <button type="button" onClick={() => openEditRecurringForm(recurring)} className="erp-icon-button-md" title="Edit recurring expense">
                              <i className="fas fa-pen text-[11px]" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget({ type: "recurring", item: recurring })}
                              className="erp-icon-button-danger-md"
                              title="Delete recurring expense"
                            >
                              <i className="fas fa-trash text-[11px]" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <FormModal show={showExpenseForm} title={editingExpense ? "Edit Business Expense" : "Record Business Expense"} size="3xl" onClose={closeExpenseForm}>
        <form onSubmit={handleExpenseSubmit(submitExpense)} className="space-y-5">
          <p className="text-[10px] text-[#546e7a]">
            {editingExpense
              ? "Update the posted expense details, references, and payment classification."
              : "Record a business expense with category, amount, payment method, and supporting details."}
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="erp-label">Category</label>
              <Controller
                control={expenseControl}
                name="categoryId"
                render={({ field }) => (
                  <SearchableSelect
                    value={field.value}
                    onChange={field.onChange}
                    options={categoryOptions}
                    placeholder="Select category"
                    searchPlaceholder="Search category..."
                    error={expenseErrors.categoryId?.message}
                  />
                )}
              />
              {expenseErrors.categoryId ? <p className="mt-1 text-[10px] text-[#c62828]">{expenseErrors.categoryId.message}</p> : null}
            </div>
            <div>
              <label className="erp-label">Expense Date</label>
              <Controller
                control={expenseControl}
                name="expenseDate"
                render={({ field }) => (
                  <DateField
                    value={field.value}
                    onChange={field.onChange}
                    error={expenseErrors.expenseDate?.message}
                  />
                )}
              />
            </div>
            <div>
              <label className="erp-label">Amount</label>
              <input type="number" step="0.01" {...registerExpense("amount")} className="erp-input" placeholder="0.00" />
              {expenseErrors.amount ? <p className="mt-1 text-[10px] text-[#c62828]">{expenseErrors.amount.message}</p> : null}
            </div>
            <div>
              <label className="erp-label">Status</label>
              <select {...registerExpense("status")} className="erp-select">
                {expenseStatusOptions.filter((option) => option.value).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="erp-label">Payment Method</label>
              <select {...registerExpense("paymentMethod")} className="erp-select">
                {paymentMethodOptions.filter((option) => option.value).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="erp-label">Payee</label>
              <input {...registerExpense("payee")} className="erp-input" placeholder="Supplier, employee, or vendor name" />
              {expenseErrors.payee ? <p className="mt-1 text-[10px] text-[#c62828]">{expenseErrors.payee.message}</p> : null}
            </div>
            <div>
              <label className="erp-label">Reference Number</label>
              <input {...registerExpense("referenceNumber")} className="erp-input" placeholder="OR, CV, cheque, or transfer reference" />
              {expenseErrors.referenceNumber ? <p className="mt-1 text-[10px] text-[#c62828]">{expenseErrors.referenceNumber.message}</p> : null}
            </div>
            <div>
              <label className="erp-label">Attachment URL</label>
              <input {...registerExpense("attachmentUrl")} className="erp-input" placeholder="https://..." />
              {expenseErrors.attachmentUrl ? <p className="mt-1 text-[10px] text-[#c62828]">{expenseErrors.attachmentUrl.message}</p> : null}
            </div>
          </div>

          <div>
            <label className="erp-label">Description</label>
            <textarea
              {...registerExpense("description")}
              rows={4}
              className="erp-input min-h-[96px] resize-none"
              placeholder="What was this expense for?"
            />
            {expenseErrors.description ? <p className="mt-1 text-[10px] text-[#c62828]">{expenseErrors.description.message}</p> : null}
          </div>

          {manualErrorMessage ? (
            <div className="rounded-sm border border-[#ef9a9a] bg-[#fff5f5] px-4 py-3 text-[11px] text-[#c62828]">
              Failed to save business expense: {manualErrorMessage}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={closeExpenseForm} className="erp-button-secondary">
              Cancel
            </button>
            <button type="submit" disabled={expenseFormBusy} className="erp-button-primary">
              {expenseFormBusy ? "Saving..." : editingExpense ? "Update Expense" : "Record Expense"}
            </button>
          </div>
        </form>
      </FormModal>

      <FormModal show={showRecurringForm} title={editingRecurring ? "Edit Recurring Expense" : "Add Recurring Expense"} size="3xl" onClose={closeRecurringForm}>
        <form onSubmit={handleRecurringSubmit(submitRecurring)} className="space-y-5">
          <p className="text-[10px] text-[#546e7a]">
            {editingRecurring
              ? "Update the recurring expense rule, schedule cadence, and activation status."
              : "Create a recurring expense rule for rent, utilities, subscriptions, or other predictable overhead."}
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="erp-label">Category</label>
              <Controller
                control={recurringControl}
                name="categoryId"
                render={({ field }) => (
                  <SearchableSelect
                    value={field.value}
                    onChange={field.onChange}
                    options={categoryOptions}
                    placeholder="Select category"
                    searchPlaceholder="Search category..."
                    error={recurringErrors.categoryId?.message}
                  />
                )}
              />
              {recurringErrors.categoryId ? <p className="mt-1 text-[10px] text-[#c62828]">{recurringErrors.categoryId.message}</p> : null}
            </div>
            <div>
              <label className="erp-label">Amount</label>
              <input type="number" step="0.01" {...registerRecurring("amount")} className="erp-input" placeholder="0.00" />
              {recurringErrors.amount ? <p className="mt-1 text-[10px] text-[#c62828]">{recurringErrors.amount.message}</p> : null}
            </div>
            <div>
              <label className="erp-label">Frequency</label>
              <select {...registerRecurring("frequency")} className="erp-select">
                {recurringFrequencyOptions.filter((option) => option.value).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {recurringErrors.frequency ? <p className="mt-1 text-[10px] text-[#c62828]">{recurringErrors.frequency.message}</p> : null}
            </div>
            <div>
              <label className="erp-label">Payment Method</label>
              <select {...registerRecurring("paymentMethod")} className="erp-select">
                {paymentMethodOptions.filter((option) => option.value).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {recurringFrequency === "weekly" ? (
              <div>
                <label className="erp-label">Weekday</label>
                <select {...registerRecurring("dayOfWeek")} className="erp-select">
                  <option value="">Select weekday</option>
                  {weekdayOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {recurringErrors.dayOfWeek ? <p className="mt-1 text-[10px] text-[#c62828]">{recurringErrors.dayOfWeek.message}</p> : null}
              </div>
            ) : null}

            {recurringFrequency === "monthly" || recurringFrequency === "annually" ? (
              <div>
                <label className="erp-label">Day of Month</label>
                <input type="number" {...registerRecurring("dayOfMonth")} className="erp-input" placeholder="1-31" />
                {recurringErrors.dayOfMonth ? <p className="mt-1 text-[10px] text-[#c62828]">{recurringErrors.dayOfMonth.message}</p> : null}
              </div>
            ) : null}

            {recurringFrequency === "annually" ? (
              <div>
                <label className="erp-label">Month</label>
                <select {...registerRecurring("monthOfYear")} className="erp-select">
                  <option value="">Select month</option>
                  {monthOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {recurringErrors.monthOfYear ? <p className="mt-1 text-[10px] text-[#c62828]">{recurringErrors.monthOfYear.message}</p> : null}
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="erp-label">Payee</label>
              <input {...registerRecurring("payee")} className="erp-input" placeholder="Who usually receives this payment?" />
              {recurringErrors.payee ? <p className="mt-1 text-[10px] text-[#c62828]">{recurringErrors.payee.message}</p> : null}
            </div>
            <label className="flex items-center gap-2 self-end rounded-sm border border-[#d7e3ea] bg-white px-3 py-2.5 text-[12px] text-[#1a3557]">
              <input type="checkbox" {...registerRecurring("isActive")} className="h-4 w-4 accent-[#0070b8]" />
              Schedule is active
            </label>
          </div>

          <div>
            <label className="erp-label">Description</label>
            <textarea
              {...registerRecurring("description")}
              rows={4}
              className="erp-input min-h-[96px] resize-none"
              placeholder="What recurring cost does this rule represent?"
            />
            {recurringErrors.description ? <p className="mt-1 text-[10px] text-[#c62828]">{recurringErrors.description.message}</p> : null}
          </div>

          {recurringErrorMessage ? (
            <div className="rounded-sm border border-[#ef9a9a] bg-[#fff5f5] px-4 py-3 text-[11px] text-[#c62828]">
              Failed to save recurring expense: {recurringErrorMessage}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={closeRecurringForm} className="erp-button-secondary">
              Cancel
            </button>
            <button type="submit" disabled={recurringFormBusy} className="erp-button-primary">
              {recurringFormBusy ? "Saving..." : editingRecurring ? "Update Schedule" : "Create Schedule"}
            </button>
          </div>
        </form>
      </FormModal>

      <ConfirmationModal
        show={Boolean(deleteTarget)}
        title={deleteTarget?.type === "recurring" ? "Delete Recurring Expense" : "Delete Business Expense"}
        message={
          deleteTarget
            ? deleteTarget.type === "recurring"
              ? `Are you sure you want to delete the recurring schedule for ${deleteTarget.item.category?.name ?? "this category"}?`
              : `Are you sure you want to delete this expense dated ${formatDate(deleteTarget.item.expenseDate)}?`
            : ""
        }
        type="error"
        showCancel
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={() => {
          void confirmDelete();
        }}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
