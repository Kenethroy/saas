import { useDeferredValue, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ConfirmationModal } from "@/shared/components/common/ConfirmationModal";
import { DateField } from "@/shared/components/common/DateField";
import { FormModal } from "@/shared/components/common/FormModal";
import { Pagination } from "@/shared/components/common/Pagination";
import { Skeleton } from "@/shared/components/common/Skeleton";
import { StatusUpdateModal } from "@/shared/components/common/StatusUpdateModal";
import { useNotification } from "@/shared/hooks/useNotification";
import { getCategoryOptions } from "@/modules/categories/api/categories.api";
import { getCustomers } from "@/modules/customers/api/customers.api";
import { useEmployees } from "@/modules/employees/hooks/useEmployees";
import { getPaymentTerms } from "@/modules/payment-terms/api/payment-terms.api";
import { getProductVariantList, resolveProductImageUrl } from "@/modules/products/api/products.api";
import {
  convertQuotation,
  createQuotation,
  deleteQuotation,
  getQuotationById,
  getQuotations,
  sendQuotation,
  updateQuotation,
  updateQuotationStatus
} from "@/modules/quotations/api/quotations.api";
import { canDeleteQuotation, canEditQuotation, getAllowedQuotationStatuses } from "@/modules/quotations/utils/status";

const statusOptions = [
  { value: "", label: "All Status" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
  { value: "converted", label: "Converted" }
];

const discountTypeOptions = [
  { value: "none", label: "No Discount" },
  { value: "percentage", label: "Percentage" },
  { value: "fixed", label: "Fixed Amount" }
];

const quotationFormSchema = z.object({
  customerId: z.union([z.coerce.number().int().positive(), z.literal(""), z.null()]),
  contactPerson: z.string().trim().max(255).optional(),
  quoteDate: z.string().min(1, "Quotation date is required"),
  validUntil: z.string().min(1, "Valid until date is required"),
  agentId: z.union([z.coerce.number().int().positive(), z.literal(""), z.null()]).optional(),
  paymentTermId: z.union([z.coerce.number().int().positive(), z.literal(""), z.null()]).optional(),
  discountType: z.enum(["none", "percentage", "fixed"]).default("none"),
  discountValue: z.coerce.number().min(0).default(0),
  notes: z.string().max(5000).optional(),
  items: z.array(
    z.object({
      productVariantId: z.union([z.coerce.number().int().positive(), z.literal(""), z.null()]),
      quantity: z.coerce.number().int().positive("Quantity must be at least 1"),
      unitPrice: z.coerce.number().min(0, "Unit price cannot be negative"),
      discountPercent: z.coerce.number().min(0).max(100).default(0),
      productName: z.string().optional(),
      variantName: z.string().optional(),
      availableStock: z.coerce.number().optional()
    })
  ).min(1, "At least one item is required")
}).superRefine((value, ctx) => {
  if (!value.customerId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["customerId"],
      message: "Customer is required"
    });
  }

  if (value.validUntil <= value.quoteDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["validUntil"],
      message: "Valid until date must be after quotation date"
    });
  }

  if (value.discountType === "percentage" && (Number(value.discountValue) < 1 || Number(value.discountValue) > 100)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["discountValue"],
      message: "Percentage discount must be between 1 and 100"
    });
  }

  value.items.forEach((item, index) => {
    if (!item.productVariantId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["items", index, "productVariantId"],
        message: "Product is required"
      });
    }

    if (Number(item.discountPercent ?? 0) !== 0 && (Number(item.discountPercent) < 1 || Number(item.discountPercent) > 100)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["items", index, "discountPercent"],
        message: "Item discount must be between 1 and 100"
      });
    }
  });
});

const defaultFormValues = {
  customerId: "",
  contactPerson: "",
  quoteDate: new Date().toISOString().slice(0, 10),
  validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  agentId: "",
  paymentTermId: "",
  discountType: "none",
  discountValue: 0,
  notes: "",
  items: []
};

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

function computeDiscountAmount(discountType, discountValue, itemsSubtotal) {
  const normalizedValue = Number(discountValue ?? 0);

  if (discountType === "percentage") {
    return itemsSubtotal * (normalizedValue / 100);
  }

  if (discountType === "fixed") {
    return normalizedValue;
  }

  return 0;
}

function clampInteger(value, min, max) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return min;
  }

  return Math.min(max, Math.max(min, Math.trunc(numericValue)));
}

function normalizePercentInput(value) {
  if (value === "" || value === null || value === undefined) {
    return "";
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return 0;
  }

  return Math.max(1, Math.min(Math.trunc(numericValue), 100));
}

function statusIcon(status) {
  switch (status) {
    case "draft":
      return "fa-pencil-alt";
    case "sent":
      return "fa-paper-plane";
    case "accepted":
      return "fa-check-circle";
    case "rejected":
      return "fa-times-circle";
    case "converted":
      return "fa-exchange-alt";
    case "expired":
      return "fa-clock";
    default:
      return "fa-circle";
  }
}

function statusBadgeClass(status) {
  switch (status) {
    case "draft":
      return "border-[#c8d3db] bg-[#f8fafb] text-[#5f7283]";
    case "sent":
      return "border-[#b8d4ea] bg-[#f4f9fd] text-[#1d6fa5]";
    case "accepted":
      return "border-[#c2ddbe] bg-[#f3faf1] text-[#356b37]";
    case "rejected":
      return "border-[#e6b8b8] bg-[#fff7f7] text-[#a44d4d]";
    case "converted":
      return "border-[#d4c8e5] bg-[#f7f3fb] text-[#6a5090]";
    case "expired":
      return "border-[#efd79a] bg-[#fff9ec] text-[#9a6a00]";
    default:
      return "border-[#b0bec5] bg-[#f3f6f9] text-[#546e7a]";
  }
}

function statusLabel(status) {
  if (!status) {
    return "Unknown";
  }

  if (status === "converted") {
    return "Converted";
  }

  return status.charAt(0).toUpperCase() + status.slice(1);
}

function isExpired(validUntil, status) {
  if (!validUntil || status === "converted") {
    return false;
  }

  return new Date(validUntil) < new Date();
}

function getAgentName(agent) {
  if (!agent) {
    return "Unassigned";
  }

  return [agent.firstName, agent.lastName].filter(Boolean).join(" ");
}

function statusChangeHint(status) {
  switch (status) {
    case "sent":
      return {
        tone: "info",
        message: "Use when the quotation has been shared with the customer and is awaiting response."
      };
    case "accepted":
      return {
        tone: "success",
        message: "Use after the customer approves the quotation. You can convert it into a sales order after saving."
      };
    case "rejected":
      return {
        tone: "error",
        message: "Use when the customer declines the quotation. This closes the approval path."
      };
    case "expired":
      return {
        tone: "warning",
        message: "Use when the quotation is no longer active because the validity period has passed."
      };
    default:
      return {
        tone: "info",
        message: "Select the next valid customer-facing status for this quotation."
      };
  }
}

function normalizeQuoteToForm(quote) {
  return {
    customerId: quote?.customerId ?? "",
    contactPerson: quote?.contactPerson ?? "",
    quoteDate: quote?.quoteDate?.slice(0, 10) ?? defaultFormValues.quoteDate,
    validUntil: quote?.validUntil?.slice(0, 10) ?? defaultFormValues.validUntil,
    agentId: quote?.agentId ?? "",
    paymentTermId: quote?.paymentTermId ?? "",
    discountType: quote?.discountType ?? "none",
    discountValue: Number(quote?.discountValue ?? 0),
    notes: quote?.notes ?? "",
    items: (quote?.items ?? []).map((item) => ({
      productVariantId: item.productVariantId,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice ?? 0),
      discountPercent: Number(item.lineTotal)
        ? Math.round((Number(item.lineDiscount ?? 0) / (Number(item.lineTotal) + Number(item.lineDiscount ?? 0))) * 100)
        : 0,
      productName: item.productName,
      variantName: item.variantName,
      availableStock: 0
    }))
  };
}

function extractApiMessage(error, fallback) {
  return error?.response?.data?.message ?? fallback;
}

function QuotationFormModal({ show, mode, quotation, onClose }) {
  const notify = useNotification();
  const queryClient = useQueryClient();
  const [productSearchInput, setProductSearchInput] = useState("");
  const [productCategoryFilter, setProductCategoryFilter] = useState("");
  const deferredProductSearch = useDeferredValue(productSearchInput.trim());

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(quotationFormSchema),
    defaultValues: defaultFormValues
  });

  const { fields, append, remove, update } = useFieldArray({
    control,
    name: "items"
  });

  useEffect(() => {
    if (!show) {
      return;
    }

    reset(quotation ? normalizeQuoteToForm(quotation) : defaultFormValues);
  }, [quotation, reset, show]);

  const { data: customersResponse, isLoading: isCustomersLoading } = useQuery({
    queryKey: ["quotation-customers"],
    queryFn: () => getCustomers({ page: 1, perPage: 100, status: true })
  });

  const { data: paymentTermsResponse, isLoading: isPaymentTermsLoading } = useQuery({
    queryKey: ["quotation-payment-terms"],
    queryFn: () => getPaymentTerms({ status: true })
  });

  const { data: categoriesResponse, isLoading: isCategoriesLoading } = useQuery({
    queryKey: ["quotation-category-options"],
    queryFn: getCategoryOptions
  });

  const { data: productVariantsResponse, isLoading: isProductVariantsLoading } = useQuery({
    queryKey: ["quotation-product-variants", deferredProductSearch, productCategoryFilter],
    queryFn: () =>
      getProductVariantList({
        ...(deferredProductSearch ? { search: deferredProductSearch } : {}),
        ...(productCategoryFilter ? { categoryId: productCategoryFilter } : {})
      })
  });

  const { data: agentsResponse, isLoading: isAgentsLoading } = useEmployees({
    page: 1,
    perPage: 100,
    position: "agent",
    status: "active"
  });

  const createMutation = useMutation({
    mutationFn: createQuotation,
    onSuccess: async () => {
      notify.success("Quotation created successfully");
      await queryClient.invalidateQueries({ queryKey: ["quotations"] });
      onClose();
    },
    onError: (error) => {
      notify.error(extractApiMessage(error, "Failed to create quotation."));
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateQuotation(id, payload),
    onSuccess: async (_, variables) => {
      notify.success("Quotation updated successfully");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["quotations"] }),
        queryClient.invalidateQueries({ queryKey: ["quotation", Number(variables.id)] })
      ]);
      onClose();
    },
    onError: (error) => {
      notify.error(extractApiMessage(error, "Failed to update quotation."));
    }
  });

  const customers = customersResponse?.data ?? [];
  const paymentTerms = paymentTermsResponse?.data ?? [];
  const categories = categoriesResponse?.data ?? [];
  const productVariants = productVariantsResponse?.data ?? [];
  const agents = agentsResponse?.data ?? [];

  const watchedItems = watch("items");
  const quoteDate = watch("quoteDate");
  const validUntil = watch("validUntil");
  const discountType = watch("discountType");
  const discountValue = watch("discountValue");

  const cartVariantIds = new Set(
    (watchedItems ?? [])
      .map((item) => Number(item?.productVariantId))
      .filter((id) => Number.isFinite(id) && id > 0)
  );

  const cartRows = (watchedItems ?? []).map((item) => {
    const variant = productVariants.find((entry) => entry.id === Number(item.productVariantId)) ?? null;
    const quantity = Number(item.quantity ?? 0);
    const unitPrice = Number(item.unitPrice ?? 0);
    const discountPercent = Number(item.discountPercent ?? 0);
    const lineSubtotal = quantity * unitPrice;
    const lineDiscount = discountPercent > 0 ? lineSubtotal * (discountPercent / 100) : 0;
    const lineTotal = Math.max(0, lineSubtotal - Math.min(lineSubtotal, lineDiscount));

    return {
      variant,
      productName: variant?.productName || item.productName || "Product",
      variantName: variant?.name || item.variantName || "Variant",
      availableStock: variant?.stock ?? item.availableStock ?? null,
      quantity,
      unitPrice,
      discountPercent,
      description: item.description ?? "",
      lineDiscount,
      lineTotal
    };
  });

  const grossSubtotal = cartRows.reduce((sum, row) => sum + row.quantity * row.unitPrice, 0);
  const itemDiscountTotal = cartRows.reduce((sum, row) => sum + row.lineDiscount, 0);
  const itemsSubtotal = cartRows.reduce((sum, row) => sum + row.lineTotal, 0);
  const discountAmount = Math.min(itemsSubtotal, computeDiscountAmount(discountType, discountValue, itemsSubtotal));
  const totalAmount = Math.max(0, itemsSubtotal - discountAmount);

  function handleCustomerChange(customerIdValue) {
    setValue("customerId", customerIdValue, {
      shouldDirty: true,
      shouldValidate: true
    });

    const customer = customers.find((entry) => entry.id === Number(customerIdValue));
    if (customer?.paymentTermId) {
      setValue("paymentTermId", customer.paymentTermId, {
        shouldDirty: true,
        shouldValidate: true
      });
    }
  }

  function addProductToCart(variant) {
    const existingIndex = fields.findIndex((field) => Number(field.productVariantId) === Number(variant.id));

    if (existingIndex >= 0) {
      const currentItem = watchedItems?.[existingIndex];
      const maxStock = Number(variant.stock ?? currentItem?.availableStock ?? 0);
      const nextQuantity = clampInteger(Number(currentItem?.quantity ?? 0) + 1, 1, Math.max(1, maxStock || 9999));
      update(existingIndex, {
        ...currentItem,
        productVariantId: variant.id,
        quantity: nextQuantity,
        unitPrice: Number(currentItem?.unitPrice ?? variant.price),
        discountPercent: Number(currentItem?.discountPercent ?? 0),
        productName: currentItem?.productName ?? variant.productName,
        variantName: currentItem?.variantName ?? variant.name,
        availableStock: currentItem?.availableStock ?? variant.stock
      });
      return;
    }

    append({
      productVariantId: variant.id,
      quantity: 1,
      unitPrice: Number(variant.price),
      discountPercent: 0,
      productName: variant.productName,
      variantName: variant.name,
      availableStock: variant.stock
    });
  }

  function updateCartQuantity(index, quantity) {
    const maxStock = Number(cartRows[index]?.availableStock ?? 0);
    const normalizedQuantity = clampInteger(quantity, 1, Math.max(1, maxStock || 9999));

    setValue(`items.${index}.quantity`, Number(normalizedQuantity), {
      shouldDirty: true,
      shouldValidate: true
    });
  }

  function updateCartPrice(index, unitPrice) {
    setValue(`items.${index}.unitPrice`, Math.max(0, Number(unitPrice)), {
      shouldDirty: true,
      shouldValidate: true
    });
  }

  function updateCartDiscount(index, discountPercent) {
    setValue(`items.${index}.discountPercent`, normalizePercentInput(discountPercent), {
      shouldDirty: true,
      shouldValidate: true
    });
  }

  async function onSubmit(values) {
    const payload = {
      customerId: Number(values.customerId),
      contactPerson: values.contactPerson?.trim() || null,
      quoteDate: values.quoteDate,
      validUntil: values.validUntil,
      agentId: values.agentId ? Number(values.agentId) : null,
      paymentTermId: values.paymentTermId ? Number(values.paymentTermId) : null,
      discountType: values.discountType,
      discountValue: Number(values.discountValue ?? 0),
      notes: values.notes?.trim() || null,
      items: values.items.map((item) => ({
        productVariantId: Number(item.productVariantId),
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        discountPercent: Number(item.discountPercent ?? 0)
      }))
    };

    if (mode === "edit" && quotation?.id) {
      await updateMutation.mutateAsync({
        id: quotation.id,
        payload
      });
      return;
    }

    await createMutation.mutateAsync(payload);
  }

  const formBusy = isSubmitting || createMutation.isPending || updateMutation.isPending;

  return (
    <FormModal show={show} title={mode === "edit" ? "Edit Quotation" : "Create Quotation"} size="6xl" onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="rounded-sm border border-[#d3dee7] bg-white p-4">
              <div className="mb-4 flex items-center gap-2 border-b border-[#e3ebf1] pb-3">
                <i className="fas fa-address-card text-[13px] text-[#0070b8]" />
                <p className="text-[13px] font-bold text-[#1a3557]">Quotation Details</p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="erp-label">Customer</label>
                  <select
                    value={watch("customerId") ?? ""}
                    onChange={(event) => handleCustomerChange(event.target.value)}
                    className="erp-select"
                    disabled={isCustomersLoading}
                  >
                    <option value="">Select customer</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                  {errors.customerId ? <p className="mt-1 text-[10px] text-[#c62828]">{errors.customerId.message}</p> : null}
                </div>

                <div>
                  <label className="erp-label">Contact Person</label>
                  <input {...register("contactPerson")} className="erp-input" placeholder="Customer contact person" />
                </div>

                <div>
                  <DateField
                    label="Quotation Date"
                    name="quoteDate"
                    value={quoteDate ?? ""}
                    onChange={(nextValue) => {
                      setValue("quoteDate", nextValue, {
                        shouldDirty: true,
                        shouldValidate: true
                      });
                    }}
                    error={errors.quoteDate?.message}
                  />
                </div>

                <div>
                  <DateField
                    label="Valid Until"
                    name="validUntil"
                    value={validUntil ?? ""}
                    min={quoteDate || undefined}
                    onChange={(nextValue) => {
                      setValue("validUntil", nextValue, {
                        shouldDirty: true,
                        shouldValidate: true
                      });
                    }}
                    error={errors.validUntil?.message}
                  />
                </div>

                <div>
                  <label className="erp-label">Assigned Agent</label>
                  <select {...register("agentId")} className="erp-select" disabled={isAgentsLoading}>
                    <option value="">Select agent</option>
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {[agent.firstName, agent.lastName].filter(Boolean).join(" ")}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="erp-label">Payment Term</label>
                  <select {...register("paymentTermId")} className="erp-select" disabled={isPaymentTermsLoading}>
                    <option value="">Select payment term</option>
                    {paymentTerms.map((term) => (
                      <option key={term.id} value={term.id}>
                        {term.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-3">
                <label className="erp-label">Notes / Terms</label>
                <textarea
                  {...register("notes")}
                  rows={4}
                  className="erp-input min-h-[110px] resize-y"
                  placeholder="Delivery notes, validity notes, payment reminders..."
                />
              </div>
            </div>

            <div className="rounded-sm border border-[#d3dee7] bg-white p-4">
              <div className="mb-3 flex items-center gap-2 border-b border-[#e3ebf1] pb-2.5">
                <i className="fas fa-boxes-stacked text-[13px] text-[#0070b8]" />
                <p className="text-[13px] font-bold text-[#1a3557]">Products</p>
              </div>

              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
                <div className="relative">
                  <i className="fas fa-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-[#90a4ae]" />
                  <input
                    value={productSearchInput}
                    onChange={(event) => setProductSearchInput(event.target.value)}
                    className="erp-input pl-8"
                    placeholder="Search products or variants"
                  />
                </div>

                <select
                  value={productCategoryFilter}
                  onChange={(event) => setProductCategoryFilter(event.target.value)}
                  className="erp-select"
                  disabled={isCategoriesLoading}
                >
                  <option value="">All categories</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-4 max-h-[430px] overflow-y-auto pr-1">
                {isProductVariantsLoading ? (
                  <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <div key={index} className="rounded-sm border border-[#d3dee7] bg-[#f8fbfd] p-2.5">
                        <div className="flex gap-2.5">
                          <Skeleton className="h-16 w-16 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <Skeleton className="h-3 w-32" />
                            <Skeleton className="mt-2 h-2.5 w-24 bg-[#e3ebf1]" />
                            <Skeleton className="mt-2 h-2.5 w-20 bg-[#e3ebf1]" />
                            <Skeleton className="mt-3 h-7 w-24" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : productVariants.length === 0 ? (
                  <div className="flex min-h-[220px] items-center justify-center text-[11px] italic text-[#90a4ae]">
                    No sellable products found for the current filters.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                    {productVariants.map((variant) => {
                      const isAdded = cartVariantIds.has(Number(variant.id));

                      return (
                        <article
                          key={variant.id}
                          className={`rounded-sm border p-2.5 transition ${
                            isAdded
                              ? "border-[#0070b8] bg-[#e8f1f8]"
                              : "border-[#d3dee7] bg-[#f8fbfd] hover:border-[#9eb9d0] hover:bg-white"
                          }`}
                        >
                          <div className="flex gap-2.5">
                            <img
                              src={resolveProductImageUrl(variant.fileUrl)}
                              alt={variant.productName}
                              className="h-16 w-16 shrink-0 rounded-sm border border-[#d3dee7] object-cover"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[11px] font-bold text-[#1a3557]">{variant.productName}</p>
                              <p className="mt-0.5 truncate text-[10px] text-[#607d8b]">{variant.name}</p>
                              <p className="mt-1 text-[9px] text-[#90a4ae]">
                                {variant.category || "Uncategorized"} | Stock {variant.stock}
                              </p>
                              <div className="mt-2 flex items-center justify-between gap-2">
                                <p className="text-[11px] font-bold text-[#0070b8]">{formatMoney(variant.price)}</p>
                                <button
                                  type="button"
                                  onClick={() => addProductToCart(variant)}
                                  className={`inline-flex h-7 items-center justify-center rounded-sm px-2.5 text-[10px] font-bold transition ${
                                    isAdded
                                      ? "border border-[#0070b8] bg-white text-[#0070b8]"
                                      : "bg-[#0070b8] text-white hover:bg-[#005a94]"
                                  }`}
                                >
                                  <i className={`mr-1 text-[10px] ${isAdded ? "fas fa-check" : "fas fa-cart-plus"}`} />
                                  {isAdded ? "Added" : "Add"}
                                </button>
                              </div>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <aside className="rounded-sm border border-[#d3dee7] bg-white shadow-[0_1px_2px_rgba(26,53,87,0.06)]">
            <section className="border-b border-[#e3ebf1] p-3">
              <div className="flex items-center gap-2 pb-3">
                <i className="fas fa-shopping-cart text-[13px] text-[#0070b8]" />
                <p className="text-[13px] font-bold text-[#1a3557]">Line Items</p>
              </div>

              {fields.length === 0 ? (
                <div className="flex min-h-[220px] items-center justify-center text-[11px] italic text-[#90a4ae]">
                  Add products from the left panel to start this quotation.
                </div>
              ) : (
                <div className="space-y-2">
                  {fields.map((field, index) => {
                    const row = cartRows[index];
                    const maxStock = Number(row?.availableStock ?? 0);
                    const maxQuantity = Math.max(1, maxStock || 9999);
                    const quantity = Number(watchedItems?.[index]?.quantity ?? 1);
                    const cartDisplayName = row?.variantName
                      ? `${row?.productName ?? "Product"} ${row.variantName}`
                      : row?.productName ?? "Product";

                    return (
                      <article key={field.id} className="rounded-sm border border-[#d3dee7] bg-[#f8fbfd] px-2 py-2">
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="min-w-0">
                            <p className="truncate text-[11px] font-bold text-[#1a3557]">{cartDisplayName}</p>
                            <p className="mt-0.5 text-[9px] text-[#90a4ae]">Stock {row?.availableStock ?? "-"}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => remove(index)}
                            className="erp-icon-button-danger"
                          >
                            <i className="fas fa-trash text-[10px]" />
                          </button>
                        </div>

                        <div className="mt-2 grid gap-2 md:grid-cols-3">
                          <div>
                            <label className="erp-label">Quantity</label>
                            <div className="flex items-center overflow-hidden rounded-sm border border-[#d3dee7] bg-white">
                              <button
                                type="button"
                                onClick={() => updateCartQuantity(index, quantity - 1)}
                                disabled={quantity <= 1}
                                className="erp-stepper-button-left"
                              >
                                <i className="fas fa-minus" />
                              </button>
                              <input
                                type="number"
                                min="1"
                                max={maxQuantity}
                                value={quantity}
                                onChange={(event) => updateCartQuantity(index, event.target.value)}
                                className="h-8 w-14 border-0 bg-white text-center text-[12px] font-bold text-[#1a3557] outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => updateCartQuantity(index, quantity + 1)}
                                className="erp-stepper-button-right"
                              >
                                <i className="fas fa-plus" />
                              </button>
                            </div>
                            {errors.items?.[index]?.quantity ? (
                              <p className="mt-1 text-[10px] text-[#c62828]">{errors.items[index].quantity.message}</p>
                            ) : null}
                          </div>

                          <div>
                            <label className="erp-label">Unit Price</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={watchedItems?.[index]?.unitPrice ?? 0}
                              readOnly
                              className="erp-input cursor-not-allowed bg-[#f8fbfd]"
                              title="Unit price is read-only"
                            />
                            {errors.items?.[index]?.unitPrice ? (
                              <p className="mt-1 text-[10px] text-[#c62828]">{errors.items[index].unitPrice.message}</p>
                            ) : null}
                          </div>

                          <div>
                            <label className="erp-label">Discount %</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="1"
                              value={watchedItems?.[index]?.discountPercent ?? 0}
                              onChange={(event) => updateCartDiscount(index, event.target.value)}
                              className="erp-input text-center"
                            />
                            {errors.items?.[index]?.discountPercent ? (
                              <p className="mt-1 text-[10px] text-[#c62828]">{errors.items[index].discountPercent.message}</p>
                            ) : null}
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[11px]">
                          <span className="text-[#607d8b]">Line Total</span>
                          <div className="text-right">
                            <span className="font-bold text-[#1a3557]">{formatMoney(row?.lineTotal ?? 0)}</span>
                            {row?.lineDiscount ? (
                              <div className="text-[9px] font-mono text-[#c62828]">- {formatMoney(row.lineDiscount)}</div>
                            ) : null}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="p-3">
              <div className="flex items-center gap-2 border-b border-[#e3ebf1] pb-3">
                <i className="fas fa-receipt text-[13px] text-[#0070b8]" />
                <p className="text-[13px] font-bold text-[#1a3557]">Summary</p>
              </div>

              <div className="mt-4 grid grid-cols-[minmax(0,1fr)_120px] gap-2">
                <div>
                  <label className="erp-label">Discount</label>
                  <select {...register("discountType")} className="erp-select">
                    {discountTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="erp-label">Value</label>
                  <input
                    type="number"
                    min={discountType === "percentage" ? "1" : "0"}
                    max={discountType === "percentage" ? "100" : undefined}
                    step="0.01"
                    {...register("discountValue")}
                    className="erp-input"
                  />
                </div>
              </div>
              {errors.discountValue ? (
                <p className="mt-1 text-[10px] text-[#c62828]">{errors.discountValue.message}</p>
              ) : null}

              <div className="mt-4 border-t border-[#e3ebf1] pt-4 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-[#607d8b]">Gross Subtotal</span>
                  <span className="font-bold text-[#1a3557]">{formatMoney(grossSubtotal)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[#607d8b]">Item Discounts</span>
                  <span className="font-bold text-[#c62828]">- {formatMoney(itemDiscountTotal)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[#607d8b]">Net Subtotal</span>
                  <span className="font-bold text-[#1a3557]">{formatMoney(itemsSubtotal)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[#607d8b]">Quotation Discount</span>
                  <span className="font-bold text-[#1a3557]">- {formatMoney(discountAmount)}</span>
                </div>
                <div className="mt-3 border-t border-[#e3ebf1] pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-bold text-[#1a3557]">Total Amount</span>
                    <span className="text-[16px] font-bold text-[#0070b8]">{formatMoney(totalAmount)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button type="button" onClick={onClose} className="erp-button-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={formBusy} className="erp-button-primary flex-1">
                  {formBusy ? "Saving..." : mode === "edit" ? "Save Changes" : "Create Quotation"}
                </button>
              </div>
            </section>
          </aside>
        </section>
      </form>
    </FormModal>
  );
}

export function QuotationsPage() {
  const navigate = useNavigate();
  const notify = useNotification();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedQuoteId, setSelectedQuoteId] = useState(null);
  const [formState, setFormState] = useState({ open: false, mode: "create", quotation: null });
  const [confirmState, setConfirmState] = useState(null);
  const [statusModal, setStatusModal] = useState(null);
  const deferredSearch = useDeferredValue(searchInput.trim());
  const perPage = 10;

  const quotationsQuery = useQuery({
    queryKey: ["quotations", { page, perPage, search: deferredSearch, status: statusFilter }],
    queryFn: () =>
      getQuotations({
        page,
        perPage,
        ...(deferredSearch ? { search: deferredSearch } : {}),
        ...(statusFilter ? { status: statusFilter } : {})
      }),
    placeholderData: keepPreviousData
  });

  const quotationDetailQuery = useQuery({
    queryKey: ["quotation", Number(selectedQuoteId)],
    queryFn: () => getQuotationById(selectedQuoteId),
    enabled: Boolean(selectedQuoteId)
  });

  const statusModalOptions = statusModal
    ? statusOptions.filter((option) => option.value && getAllowedQuotationStatuses(statusModal.currentStatus).includes(option.value))
    : [];
  const selectedStatusHint = statusModal ? statusChangeHint(statusModal.nextStatus) : statusChangeHint();

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => updateQuotationStatus(id, status),
    onSuccess: async (response, variables) => {
      notify.success(`${response.data.quoteNumber} marked as ${statusLabel(variables.status).toLowerCase()}.`);
      setStatusModal(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["quotations"] }),
        queryClient.invalidateQueries({ queryKey: ["quotation", Number(variables.id)] })
      ]);

      if (variables.status === "accepted") {
        openConfirm({
          title: "Convert to Sales Order",
          message: `${response.data.quoteNumber} is now accepted. Do you want to convert it into a sales order now?`,
          type: "warning",
          confirmText: "Convert Now",
          action: async () => {
            await convertMutation.mutateAsync(variables.id);
          }
        });
      }
    },
    onError: (error) => notify.error(extractApiMessage(error, "Failed to update quotation status."))
  });

  const sendMutation = useMutation({
    mutationFn: sendQuotation,
    onSuccess: async (response, id) => {
      notify.success(`${response.data.quoteNumber} marked as sent.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["quotations"] }),
        queryClient.invalidateQueries({ queryKey: ["quotation", Number(id)] })
      ]);
    },
    onError: (error) => notify.error(extractApiMessage(error, "Failed to send quotation."))
  });

  const convertMutation = useMutation({
    mutationFn: convertQuotation,
    onSuccess: async (response, id) => {
      notify.success(`${response.data.quoteNumber} converted to ${response.data.salesOrderNumber}.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["quotations"] }),
        queryClient.invalidateQueries({ queryKey: ["quotation", Number(id)] }),
        queryClient.invalidateQueries({ queryKey: ["sales-orders"] })
      ]);
      navigate(`/sales-orders/${response.data.salesOrderId}`);
    },
    onError: (error) => notify.error(extractApiMessage(error, "Failed to convert quotation."))
  });

  const deleteMutation = useMutation({
    mutationFn: deleteQuotation,
    onSuccess: async () => {
      notify.success("Quotation deleted successfully.");
      setSelectedQuoteId(null);
      await queryClient.invalidateQueries({ queryKey: ["quotations"] });
    },
    onError: (error) => notify.error(extractApiMessage(error, "Failed to delete quotation."))
  });

  const quotations = quotationsQuery.data?.data ?? [];
  const meta = quotationsQuery.data?.meta ?? { currentPage: page, lastPage: 1, total: 0 };
  const selectedQuote = quotationDetailQuery.data?.data ?? null;

  function clearFilters() {
    setPage(1);
    setSearchInput("");
    setStatusFilter("");
  }

  function openConfirm(config) {
    setConfirmState(config);
  }

  function openCreate() {
    navigate("/quotations/create");
  }

  return (
    <div className="space-y-4">
      <section className="erp-page-section">
        <div className="erp-page-header">
          <div className="flex items-center gap-3">
            <i className="fas fa-file-invoice text-[18px] text-[#90caf9]" />
            <div>
              <div className="erp-page-title">Quotations &amp; Estimates</div>
              <div className="erp-page-description">
                Create customer quotations, track approvals, and convert accepted quotes to sales orders
              </div>
            </div>
          </div>
          <button type="button" onClick={openCreate} className="erp-header-primary-button">
            <i className="fas fa-plus mr-1.5" />
            Create Quotation
          </button>
        </div>
        <div className="erp-page-filters">
          <div className="erp-filter-label">
            <i className="fas fa-filter mr-1" />
            Filters
          </div>

          <div className="relative min-w-[220px] flex-1 md:max-w-[320px]">
            <i className="fas fa-search pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#90a4ae]" />
            <input
              value={searchInput}
              onChange={(event) => {
                setPage(1);
                setSearchInput(event.target.value);
              }}
              placeholder="Quote #, customer, contact person..."
              className="erp-input pl-7"
            />
          </div>

          <div className="relative min-w-[180px]">
            <i className="fas fa-signal pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#90a4ae]" />
            <select
              value={statusFilter}
              onChange={(event) => {
                setPage(1);
                setStatusFilter(event.target.value);
              }}
              className="erp-select pl-7"
            >
              {statusOptions.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={clearFilters}
            className="erp-filter-clear-button"
          >
            <i className="fas fa-times mr-1" />
            Clear
          </button>
        </div>
      </section>

      <section className="table-card">
        <div className="overflow-x-auto">
          <table className="erp-table w-full min-w-[1000px]">
            <thead>
              <tr>
                <th>#</th>
                <th>Quote #</th>
                <th>Customer</th>
                <th>Quote Date</th>
                <th>Valid Until</th>
                <th>Agent</th>
                <th className="text-right">Amount</th>
                <th className="!text-center">Status</th>
                <th className="!text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {quotationsQuery.isLoading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <tr key={index}>
                    <td colSpan={9} className="px-4 py-3">
                      <Skeleton className="h-8 w-full" />
                    </td>
                  </tr>
                ))
              ) : quotations.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#e8f1f8]">
                        <i className="fas fa-file-invoice text-[24px] text-[#90a4ae]" />
                      </div>
                      <div className="text-[13px] font-bold text-[#546e7a]">No quotations found</div>
                      <div className="mt-1 text-[11px] text-[#90a4ae]">Create your first quotation to get started</div>
                    </div>
                  </td>
                </tr>
              ) : (
                quotations.map((quote, index) => (
                  <tr key={quote.id}>
                    <td className="text-center font-mono text-[10px] text-[#90a4ae]">{(meta.currentPage - 1) * perPage + index + 1}</td>
                    <td className="font-mono font-bold text-[#0070b8]">{quote.quoteNumber}</td>
                    <td>
                      <div className="font-bold text-[#1a3557]">{quote.customer?.name}</div>
                      {quote.contactPerson ? (
                        <div className="mt-0.5 text-[10px] text-[#90a4ae]">
                          <i className="fas fa-user mr-1" />
                          {quote.contactPerson}
                        </div>
                      ) : null}
                    </td>
                    <td>{formatDate(quote.quoteDate)}</td>
                    <td>
                      <span className={isExpired(quote.validUntil, quote.status) ? "font-medium text-[#c62828]" : "text-[#546e7a]"}>
                        {isExpired(quote.validUntil, quote.status) ? <i className="fas fa-exclamation-triangle mr-1 text-[10px]" /> : null}
                        {formatDate(quote.validUntil)}
                      </span>
                    </td>
                    <td>{getAgentName(quote.agent)}</td>
                    <td className="text-right font-mono font-bold text-[#1a3557]">{formatMoney(quote.totalAmount)}</td>
                    <td className="text-center">
                      <span className={`erp-status-badge ${statusBadgeClass(quote.status)}`}>
                        <span className="erp-status-badge-dot" />
                        {statusLabel(quote.status)}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center justify-center gap-1.5">
                        {getAllowedQuotationStatuses(quote.status).some((status) => status !== quote.status) ? (
                          <button
                            type="button"
                            onClick={() =>
                              setStatusModal({
                                id: quote.id,
                                referenceValue: quote.quoteNumber,
                                currentStatus: quote.status,
                                nextStatus: quote.status
                              })
                            }
                            className="erp-icon-button-violet"
                            title="Update status"
                          >
                            <i className="fas fa-arrows-rotate text-[11px]" />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => navigate(`/quotations/${quote.id}`)}
                          className="erp-icon-button"
                          title="View Details"
                        >
                          <i className="fas fa-eye text-[11px]" />
                        </button>

                        {canEditQuotation(quote.status) ? (
                          <button
                            type="button"
                            onClick={() => navigate(`/quotations/${quote.id}/edit`)}
                            className="erp-icon-button-warning"
                            title="Edit Quotation"
                          >
                            <i className="fas fa-edit text-[11px]" />
                          </button>
                        ) : null}

                        {quote.status === "accepted" ? (
                          <button
                            type="button"
                            onClick={() =>
                              openConfirm({
                                title: "Convert to Sales Order",
                                message: `Convert ${quote.quoteNumber} to a sales order?`,
                                type: "warning",
                                confirmText: "Convert",
                                action: () => convertMutation.mutate(quote.id)
                              })
                            }
                            className="erp-icon-button-purple"
                            title="Convert to Sales Order"
                          >
                            <i className="fas fa-exchange-alt text-[11px]" />
                          </button>
                        ) : null}

                        {canDeleteQuotation(quote.status) ? (
                          <button
                            type="button"
                            onClick={() =>
                              openConfirm({
                                title: "Delete Quotation",
                                message: `Delete ${quote.quoteNumber}? This action cannot be undone.`,
                                type: "error",
                                confirmText: "Delete",
                                action: () => deleteMutation.mutate(quote.id)
                              })
                            }
                            className="erp-icon-button-danger"
                            title="Delete Quotation"
                          >
                            <i className="fas fa-trash text-[11px]" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={meta.currentPage ?? 1}
          lastPage={meta.lastPage ?? 1}
          perPage={perPage}
          total={meta.total ?? 0}
          itemLabel="quotations"
          loading={quotationsQuery.isFetching}
          onPrevious={() => setPage((current) => Math.max(1, current - 1))}
          onNext={() => setPage((current) => Math.min(meta.lastPage ?? 1, current + 1))}
          onGoto={(targetPage) => setPage(targetPage)}
        />
      </section>

      <QuotationFormModal
        show={formState.open && formState.mode === "edit"}
        mode={formState.mode}
        quotation={formState.quotation}
        onClose={() => setFormState({ open: false, mode: "create", quotation: null })}
      />

      <FormModal show={Boolean(selectedQuoteId)} title="Quotation Details" size="4xl" onClose={() => setSelectedQuoteId(null)}>
        {quotationDetailQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
        ) : selectedQuote ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-[#1a3557] px-4 py-3">
              <div>
                <div className="font-mono text-[16px] font-bold text-white">{selectedQuote.quoteNumber}</div>
                <div className="mt-0.5 text-[10px] text-[#90caf9]">
                  {formatDate(selectedQuote.quoteDate)} | Valid until {formatDate(selectedQuote.validUntil)}
                </div>
              </div>
              <span className={`inline-flex items-center gap-1 rounded-sm border px-2.5 py-1 text-[10px] font-bold ${statusBadgeClass(selectedQuote.status)}`}>
                <i className={`fas ${statusIcon(selectedQuote.status)}`} />
                {statusLabel(selectedQuote.status)}
              </span>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="border border-[#b0bec5] bg-white p-3">
                <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.6px] text-[#90a4ae]">Customer</div>
                <div className="text-[13px] font-bold text-[#1a3557]">{selectedQuote.customer?.name}</div>
                {selectedQuote.contactPerson ? (
                  <div className="mt-1 text-[11px] text-[#546e7a]">
                    <i className="fas fa-user mr-1 text-[#90a4ae]" />
                    {selectedQuote.contactPerson}
                  </div>
                ) : null}
                <div className="mt-3 text-[10px] text-[#90a4ae]">Agent</div>
                <div className="text-[12px] font-medium text-[#1a3557]">{getAgentName(selectedQuote.agent)}</div>
              </div>

              <div className="border border-[#b0bec5] bg-white p-3">
                <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.6px] text-[#90a4ae]">Quotation Info</div>
                <div className="text-[10px] text-[#90a4ae]">Quotation Date</div>
                <div className="mb-2 text-[12px] font-bold text-[#1a3557]">{formatDate(selectedQuote.quoteDate)}</div>
                <div className="text-[10px] text-[#90a4ae]">Valid Until</div>
                <div className={isExpired(selectedQuote.validUntil, selectedQuote.status) ? "text-[12px] font-medium text-[#c62828]" : "text-[12px] font-medium text-[#1a3557]"}>
                  {formatDate(selectedQuote.validUntil)}
                </div>
                <div className="mt-3 text-[10px] text-[#90a4ae]">Payment Term</div>
                <div className="text-[12px] font-medium text-[#1a3557]">{selectedQuote.paymentTerm?.name ?? "N/A"}</div>
                {selectedQuote.salesOrder ? (
                  <>
                    <div className="mt-3 text-[10px] text-[#90a4ae]">Converted Sales Order</div>
                    <button
                      type="button"
                      onClick={() => navigate(`/sales-orders/${selectedQuote.salesOrder.id}`)}
                      className="text-[12px] font-bold text-[#0070b8] underline-offset-2 hover:underline"
                    >
                      {selectedQuote.salesOrder.salesOrderNumber}
                    </button>
                  </>
                ) : null}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.6px] text-[#90a4ae]">
                <i className="fas fa-list" />
                Line Items
              </div>
              <div className="overflow-hidden border border-[#b0bec5] bg-white">
                <table className="erp-table w-full min-w-[700px]">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Description</th>
                      <th className="text-right">Qty</th>
                      <th className="text-right">Unit Price</th>
                      <th className="text-right">Discount</th>
                      <th className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedQuote.items.map((item) => (
                      <tr key={item.id}>
                        <td className="font-bold text-[#1a3557]">
                          {item.productName}
                          <div className="mt-0.5 text-[10px] font-normal text-[#607d8b]">{item.variantName}</div>
                        </td>
                        <td className="text-[#546e7a]">{item.description || "N/A"}</td>
                        <td className="text-right font-mono">{item.quantity}</td>
                        <td className="text-right font-mono">{formatMoney(item.unitPrice)}</td>
                        <td className="text-right font-mono text-[#c62828]">- {formatMoney(item.lineDiscount)}</td>
                        <td className="text-right font-mono font-bold text-[#1a3557]">{formatMoney(item.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="border border-[#b0bec5] bg-white">
              <div className="flex items-center justify-between border-b border-[#e8ecef] px-4 py-2">
                <span className="text-[11px] text-[#546e7a]">Items Subtotal</span>
                <span className="font-mono text-[12px] text-[#1a3557]">{formatMoney(selectedQuote.itemsSubtotal)}</span>
              </div>
              <div className="flex items-center justify-between border-b border-[#e8ecef] px-4 py-2">
                <span className="text-[11px] text-[#546e7a]">Order Discount</span>
                <span className="font-mono text-[12px] text-[#c62828]">- {formatMoney(selectedQuote.discountAmount)}</span>
              </div>
              <div className="flex items-center justify-between bg-[#1a3557] px-4 py-2.5">
                <span className="text-[11px] font-bold uppercase tracking-[0.4px] text-[#90caf9]">Total Amount</span>
                <span className="font-mono text-[18px] font-bold text-white">{formatMoney(selectedQuote.totalAmount)}</span>
              </div>
            </div>

            {selectedQuote.notes ? (
              <div className="border border-[#b0bec5] bg-white p-3">
                <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.6px] text-[#90a4ae]">
                  <i className="fas fa-sticky-note mr-1" />
                  Notes / Terms
                </div>
                <div className="text-[12px] leading-relaxed text-[#546e7a]">{selectedQuote.notes}</div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="rounded-sm border border-[#ef9a9a] bg-[#fff5f5] px-3 py-2 text-[12px] text-[#c62828]">
            Unable to load quotation details.
          </div>
        )}
      </FormModal>

      <ConfirmationModal
        show={Boolean(confirmState)}
        title={confirmState?.title ?? ""}
        message={confirmState?.message ?? ""}
        type={confirmState?.type ?? "warning"}
        showCancel
        confirmText={confirmState?.confirmText ?? "Confirm"}
        cancelText="Cancel"
        onConfirm={async () => {
          const action = confirmState?.action;
          setConfirmState(null);
          await action?.();
        }}
        onClose={() => setConfirmState(null)}
      />

      <StatusUpdateModal
        show={Boolean(statusModal)}
        title="Update Quotation Status"
        referenceLabel="Quotation"
        referenceValue={statusModal?.referenceValue}
        currentStatus={statusModal?.currentStatus}
        currentStatusLabel={statusLabel(statusModal?.currentStatus ?? "")}
        selectedStatus={statusModal?.nextStatus ?? ""}
        selectedStatusLabel={statusLabel(statusModal?.nextStatus ?? "")}
        options={statusModalOptions}
        getStatusClassName={statusBadgeClass}
        helperText={selectedStatusHint.message}
        helperTone={selectedStatusHint.tone}
        isSubmitting={statusMutation.isPending}
        disableSubmit={!statusModal || statusModal.nextStatus === statusModal.currentStatus}
        onSelectStatus={(nextStatus) =>
          setStatusModal((current) => (current ? { ...current, nextStatus } : current))
        }
        onClose={() => setStatusModal(null)}
        onConfirm={async () => {
          if (!statusModal || statusModal.nextStatus === statusModal.currentStatus) {
            return;
          }

          await statusMutation.mutateAsync({
            id: statusModal.id,
            status: statusModal.nextStatus
          });
        }}
      />
    </div>
  );
}
