import { useDeferredValue, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Skeleton } from "@/shared/components/common/Skeleton";
import { DateField } from "@/shared/components/common/DateField";
import { SearchableSelect } from "@/shared/components/common/SearchableSelect";
import SelectionModal from "@/shared/components/common/SelectionModal";
import { useNotification } from "@/shared/hooks/useNotification";
import { getCategoryOptions } from "@/modules/categories/api/categories.api";
import { getCustomers } from "@/modules/customers/api/customers.api";
import { useEmployees } from "@/modules/employees/hooks/useEmployees";
import { getPaymentTerms } from "@/modules/payment-terms/api/payment-terms.api";
import { getProductVariantList, resolveProductImageUrl } from "@/modules/products/api/products.api";
import { createQuotation, getQuotationById, updateQuotation } from "@/modules/quotations/api/quotations.api";
import { canEditQuotation } from "@/modules/quotations/utils/status";

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

function extractApiMessage(error, fallback) {
  return error?.response?.data?.message ?? fallback;
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
      discountPercent:
        Number(item.unitPrice ?? 0) > 0 && Number(item.quantity ?? 0) > 0
          ? Math.round((Number(item.lineDiscount ?? 0) / (Number(item.unitPrice) * Number(item.quantity))) * 100)
          : 0,
      productName: item.productName,
      variantName: item.variantName,
      availableStock: Number(item.availableStock ?? 0)
    }))
  };
}

export function QuotationCreatePage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const notify = useNotification();
  const queryClient = useQueryClient();
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [productSearchInput, setProductSearchInput] = useState("");
  const [productCategoryFilter, setProductCategoryFilter] = useState("");
  const deferredProductSearch = useDeferredValue(productSearchInput.trim());
  const isEditMode = Boolean(id);

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

  const {
    data: quotationResponse,
    isLoading: isQuotationLoading,
    isError: isQuotationError,
    error: quotationError
  } = useQuery({
    queryKey: ["quotation", id],
    queryFn: () => getQuotationById(id),
    enabled: isEditMode
  });

  const { data: customersResponse, isLoading: isCustomersLoading, isFetching: isCustomersFetching, refetch: refetchCustomers } = useQuery({
    queryKey: ["quotation-create-customers"],
    queryFn: () => getCustomers({ page: 1, perPage: 100, status: true })
  });

  const { data: paymentTermsResponse, isLoading: isPaymentTermsLoading } = useQuery({
    queryKey: ["quotation-create-payment-terms"],
    queryFn: () => getPaymentTerms({ status: true })
  });

  const { data: categoriesResponse, isLoading: isCategoriesLoading } = useQuery({
    queryKey: ["quotation-create-category-options"],
    queryFn: getCategoryOptions
  });

  const { data: productVariantsResponse, isLoading: isProductVariantsLoading } = useQuery({
    queryKey: ["quotation-create-product-variants", deferredProductSearch, productCategoryFilter],
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

  const saveMutation = useMutation({
    mutationFn: (payload) => (isEditMode ? updateQuotation(id, payload) : createQuotation(payload)),
    onSuccess: async (response) => {
      if (isEditMode) {
        notify.success("Quotation updated successfully");
        reset(normalizeQuoteToForm(response.data));
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["quotations"] }),
          queryClient.invalidateQueries({ queryKey: ["quotation", id] })
        ]);
        navigate("/quotations", { replace: true });
        return;
      }

      notify.success("Quotation created successfully");
      reset(defaultFormValues);
      await queryClient.invalidateQueries({ queryKey: ["quotations"] });
      navigate("/quotations", {
        replace: true,
        state: {
          createdQuotationId: response.data.id
        }
      });
    },
    onError: (error) => {
      notify.error(extractApiMessage(error, `Failed to ${isEditMode ? "update" : "create"} quotation.`));
    }
  });

  const customers = customersResponse?.data ?? [];
  const paymentTerms = paymentTermsResponse?.data ?? [];
  const categories = categoriesResponse?.data ?? [];
  const productVariants = productVariantsResponse?.data ?? [];
  const agents = agentsResponse?.data ?? [];

  const watchedItems = watch("items");
  const customerId = watch("customerId");
  const quoteDate = watch("quoteDate");
  const validUntil = watch("validUntil");
  const discountType = watch("discountType");
  const discountValue = watch("discountValue");
  const quotation = quotationResponse?.data ?? null;
  const quotationIsEditable = !isEditMode || canEditQuotation(quotation?.status);
  const selectedCustomer = customers.find((entry) => String(entry.id) === String(customerId ?? ""));
  const agentOptions = agents.map((agent) => ({
    value: agent.id,
    label: [agent.firstName, agent.lastName].filter(Boolean).join(" ") || agent.username || `Agent #${agent.id}`
  }));

  useEffect(() => {
    if (!isEditMode || !quotation) {
      return;
    }

    reset(normalizeQuoteToForm(quotation));
  }, [isEditMode, quotation, reset]);

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

  function handleSelectCustomer(customer) {
    handleCustomerChange(customer.id);
    setShowCustomerModal(false);
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
    if (quantity === "") {
      setValue(`items.${index}.quantity`, "", {
        shouldDirty: true,
        shouldValidate: false
      });
      return;
    }

    const maxStock = Number(cartRows[index]?.availableStock ?? 0);
    const normalizedQuantity = clampInteger(quantity, 1, Math.max(1, maxStock || 9999));

    setValue(`items.${index}.quantity`, Number(normalizedQuantity), {
      shouldDirty: true,
      shouldValidate: true
    });
  }

  function finalizeCartQuantity(index, quantity) {
    const nextQuantity = quantity === "" ? 1 : quantity;
    updateCartQuantity(index, nextQuantity);
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

    if (isEditMode && !quotationIsEditable) {
      notify.error("Only draft or sent quotations can be edited.");
      return;
    }

    await saveMutation.mutateAsync(payload);
  }

  const formBusy = isSubmitting || saveMutation.isPending || isQuotationLoading;

  return (
    <div className="space-y-3">
      <section className="erp-page-section">
        <div className="erp-page-header">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/quotations")}
              className="erp-back-button"
              title="Back to Quotations"
            >
              <i className="fas fa-arrow-left text-[12px]" />
            </button>
            <div>
              <div className="erp-page-title">{isEditMode ? "Edit Quotation" : "Create Quotation"}</div>
              <div className="erp-page-description">
                {isEditMode ? "Update quotation details while it is still editable" : "Prepare a quotation for customer review"}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => navigate("/quotations")}
              className="rounded-sm border border-[#4a7fa8] bg-transparent px-3.5 py-1.5 text-[12px] font-bold text-white transition hover:bg-white/10"
            >
              Cancel
            </button>
            <button type="submit" form="quotation-create-form" disabled={formBusy || !quotationIsEditable} className="erp-header-primary-button disabled:bg-[#b0bec5]">
              <i className="fas fa-save mr-1.5" />
              {formBusy ? "Saving..." : isEditMode ? "Update Quotation" : "Create Quotation"}
            </button>
          </div>
        </div>
      </section>

      {isEditMode && isQuotationError ? (
        <section className="rounded-sm border border-[#ef9a9a] bg-[#fff5f5] px-4 py-3 text-[11px] text-[#c62828]">
          Failed to load quotation{quotationError?.message ? `: ${quotationError.message}` : "."}
        </section>
      ) : null}

      {isEditMode && quotation && !quotationIsEditable ? (
        <section className="rounded-sm border border-[#ffe082] bg-[#fff8e1] px-4 py-3 text-[11px] text-[#8d6e00]">
          This quotation is in <span className="font-bold">{quotation.status}</span> status and can no longer be edited.
        </section>
      ) : null}

      <form id="quotation-create-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4 erp-form-stack">
        <div className="erp-page-main-card p-4">
          <div className="mb-4 flex items-center gap-2 border-b border-[#e3ebf1] pb-3">
            <i className="fas fa-address-card text-[13px] text-[#0070b8]" />
            <p className="text-[13px] font-bold text-[#1a3557]">Customer & Quotation Details</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div>
              <label className="erp-label">Customer</label>
              <button
                type="button"
                onClick={() => setShowCustomerModal(true)}
                disabled={isCustomersLoading}
                className={`erp-select flex h-auto min-h-[36px] items-center justify-between gap-3 text-left ${
                  errors.customerId ? "erp-input-error" : ""
                } ${isCustomersLoading ? "cursor-not-allowed opacity-70" : ""}`}
              >
                <span className="min-w-0">
                  <span className={`block truncate ${selectedCustomer ? "text-[#1d2730]" : "text-[#90a4ae]"}`}>
                    {isCustomersLoading ? "Loading customers..." : selectedCustomer?.name ?? "Select customer"}
                  </span>
                  {selectedCustomer ? (
                    <span className="mt-0.5 block truncate text-[10px] text-[#78909c]">
                      {selectedCustomer.company || selectedCustomer.contactPerson || selectedCustomer.email || "Customer record"}
                    </span>
                  ) : null}
                </span>
                <i className="fas fa-search shrink-0 text-[11px] text-[#78909c]" />
              </button>
              {errors.customerId ? <p className="mt-1 text-[10px] text-[#c62828]">{errors.customerId.message}</p> : null}
            </div>

            <div>
              <label className="erp-label">Sales Agent</label>
              <SearchableSelect
                value={watch("agentId") ?? ""}
                onChange={(nextValue) => {
                  setValue("agentId", nextValue, {
                    shouldDirty: true,
                    shouldValidate: true
                  });
                }}
                options={agentOptions}
                placeholder={isAgentsLoading ? "Loading agents..." : "Select agent"}
                searchPlaceholder="Search agent..."
                disabled={isAgentsLoading}
                error={errors.agentId?.message}
              />
              {errors.agentId ? <p className="mt-1 text-[10px] text-[#c62828]">{errors.agentId.message}</p> : null}
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
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div>
              <label className="erp-label">Contact Person</label>
              <input {...register("contactPerson")} className="erp-input" placeholder="Customer contact person" />
            </div>

            <div>
              <label className="erp-label">Notes / Terms</label>
              <textarea
                {...register("notes")}
                rows={3}
                className="erp-input min-h-[96px] resize-y"
                placeholder="Add payment terms, delivery conditions, or other notes..."
              />
            </div>
          </div>
        </div>

        <section className="grid gap-4 xl:grid-cols-2">
          <div className="app-shell-card p-4">
            <div className="flex flex-col gap-3">
              <div className="overflow-x-auto">
                <div className="flex min-w-max gap-2 pb-1">
                  <button
                    type="button"
                    onClick={() => setProductCategoryFilter("")}
                    disabled={isCategoriesLoading}
                    className={`rounded-sm border px-3 py-1.5 text-[11px] font-bold transition ${
                      productCategoryFilter === ""
                        ? "border-[#0070b8] bg-[#0070b8] text-white"
                        : "border-[#c8d6e2] bg-[#f8fbfd] text-[#546e7a] hover:border-[#9eb9d0] hover:bg-white"
                    }`}
                  >
                    All
                  </button>

                  {isCategoriesLoading
                    ? Array.from({ length: 5 }).map((_, index) => (
                        <Skeleton key={`quote-cat-tab-sk-${index}`} className="h-8 w-24 rounded-sm" />
                      ))
                    : categories.map((category) => {
                        const isActive = String(productCategoryFilter) === String(category.id);

                        return (
                          <button
                            key={category.id}
                            type="button"
                            onClick={() => setProductCategoryFilter(String(category.id))}
                            className={`whitespace-nowrap rounded-sm border px-3 py-1.5 text-[11px] font-bold transition ${
                              isActive
                                ? "border-[#0070b8] bg-[#0070b8] text-white"
                                : "border-[#c8d6e2] bg-[#f8fbfd] text-[#546e7a] hover:border-[#9eb9d0] hover:bg-white"
                            }`}
                          >
                            {category.name}
                          </button>
                        );
                      })}
                </div>
              </div>

              <div className="relative">
                <i className="fas fa-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-[#90a4ae]" />
                <input
                  value={productSearchInput}
                  onChange={(event) => setProductSearchInput(event.target.value)}
                  className="erp-input pl-8"
                  placeholder="Search products or variants"
                />
              </div>
            </div>

            <div className="mt-4 max-h-[700px] overflow-y-auto pr-1">
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

          <aside className="app-shell-card">
            <section className="border-b border-[#e3ebf1] p-3">
              <div className="flex items-center gap-2 pb-3">
                <i className="fas fa-shopping-cart text-[13px] text-[#0070b8]" />
                <p className="text-[13px] font-bold text-[#1a3557]">Quote Items</p>
              </div>

              {fields.length === 0 ? (
                <div className="flex min-h-[220px] items-center justify-center text-[11px] italic text-[#90a4ae]">
                  Add products from the left panel to start this quotation.
                </div>
              ) : (
                <div className="max-h-[510px] space-y-2 overflow-y-auto pr-1">
                  {fields.map((field, index) => {
                    const row = cartRows[index];
                    const maxStock = Number(row?.availableStock ?? 0);
                    const maxQuantity = Math.max(1, maxStock || 9999);
                    const quantityInputValue = watchedItems?.[index]?.quantity ?? 1;
                    const quantity = quantityInputValue === "" ? 0 : Number(quantityInputValue ?? 1);
                    const discountInputValue = watchedItems?.[index]?.discountPercent ?? 0;
                    const itemErrors = errors.items?.[index];
                    const cartDisplayName = row?.variantName
                      ? `${row?.productName ?? "Product"} ${row.variantName}`
                      : row?.productName ?? "Product";

                    return (
                      <article key={field.id} className="rounded-sm border border-[#d3dee7] bg-[#f8fbfd] px-2.5 py-2">
                        <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[11px] font-bold text-[#1a3557]" title={cartDisplayName}>
                              {cartDisplayName}
                            </p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[9px] text-[#90a4ae]">
                              <span>Stock {row?.availableStock ?? "-"}</span>
                              <span className="text-[#c0cdd7]">|</span>
                              <span>{formatMoney(watchedItems?.[index]?.unitPrice ?? 0)} / unit</span>
                            </div>
                          </div>

                          <div className="flex shrink-0 flex-col gap-[3px]">
                            <span className="text-[9px] font-bold uppercase tracking-[0.3px] text-[#90a4ae]">Qty</span>
                            <div className="flex items-center overflow-hidden rounded-sm border border-[#d3dee7] bg-white">
                              <button
                                type="button"
                                onClick={() => updateCartQuantity(index, quantity - 1)}
                                disabled={quantity <= 1}
                                className="inline-flex h-[26px] w-[26px] items-center justify-center border-r border-[#d3dee7] bg-[#f3f6f9] text-[10px] text-[#546e7a] transition hover:bg-[#e8f1f8] hover:text-[#0070b8] disabled:cursor-not-allowed disabled:bg-[#f9fafc] disabled:text-[#b0bec5]"
                              >
                                <i className="fas fa-minus" />
                              </button>
                              <input
                                type="number"
                                min="1"
                                max={maxQuantity}
                                value={quantityInputValue}
                                onChange={(event) => updateCartQuantity(index, event.target.value)}
                                onBlur={(event) => finalizeCartQuantity(index, event.target.value)}
                                className="h-[26px] w-11 border-0 bg-white text-center text-[12px] font-bold text-[#1a3557] outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => updateCartQuantity(index, quantity + 1)}
                                className="inline-flex h-[26px] w-[26px] items-center justify-center border-l border-[#d3dee7] bg-[#f3f6f9] text-[10px] text-[#546e7a] transition hover:bg-[#e8f1f8] hover:text-[#0070b8] disabled:cursor-not-allowed disabled:bg-[#f9fafc] disabled:text-[#b0bec5]"
                              >
                                <i className="fas fa-plus" />
                              </button>
                            </div>
                          </div>

                          <div className="flex shrink-0 flex-col gap-[3px]">
                            <span className="text-[9px] font-bold uppercase tracking-[0.3px] text-[#90a4ae]">Disc %</span>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="1"
                              value={discountInputValue}
                              onChange={(event) => updateCartDiscount(index, event.target.value)}
                              onFocus={(event) => event.target.select()}
                              className="h-[26px] w-14 rounded-sm border border-[#d3dee7] bg-white px-1.5 text-center text-[12px] font-bold text-[#1a3557] outline-none transition focus:border-[#0070b8]"
                            />
                          </div>

                          <div className="min-w-[86px] shrink-0">
                            <div className="text-[9px] font-bold uppercase tracking-[0.3px] text-[#90a4ae]">Total</div>
                            <div className="mt-[3px] text-right">
                              <div className="text-[12px] font-bold text-[#0070b8]">{formatMoney(row?.lineTotal ?? 0)}</div>
                              {row?.lineDiscount ? (
                                <div className="text-[9px] font-mono text-[#c62828]">- {formatMoney(row.lineDiscount)}</div>
                              ) : null}
                            </div>
                          </div>

                          <div className="shrink-0 pt-[13px]">
                            <button
                              type="button"
                              onClick={() => remove(index)}
                              className="erp-icon-button-danger"
                              title="Remove item"
                            >
                              <i className="fas fa-times text-[10px]" />
                            </button>
                          </div>
                        </div>

                        {itemErrors ? (
                          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[#c62828]">
                            {itemErrors.productVariantId?.message ? <span>{itemErrors.productVariantId.message}</span> : null}
                            {itemErrors.quantity?.message ? <span>{itemErrors.quantity.message}</span> : null}
                            {itemErrors.unitPrice?.message ? <span>{itemErrors.unitPrice.message}</span> : null}
                            {itemErrors.discountPercent?.message ? <span>{itemErrors.discountPercent.message}</span> : null}
                          </div>
                        ) : null}
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
            </section>
          </aside>
        </section>
      </form>

      <SelectionModal
        show={showCustomerModal}
        title="Select Customer"
        subtitle="Search and choose the customer for this quotation."
        searchPlaceholder="Search customer by name, company, or email..."
        items={customers}
        searchFields={["name", "company", "email", "contactPerson"]}
        onClose={() => setShowCustomerModal(false)}
        onSelect={handleSelectCustomer}
        onRefresh={() => refetchCustomers()}
        refreshing={isCustomersFetching}
        size="3xl"
        renderItems={({ filteredItems, selectItem }) => (
          <div className="flex flex-col">
            {filteredItems.map((customer) => (
              <button
                key={customer.id}
                type="button"
                onClick={() => selectItem(customer)}
                className="flex items-center gap-3 border-b border-[#edf2f6] px-4 py-3 text-left transition hover:bg-[#f6fbff]"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e8f1f8] text-[12px] font-bold text-[#0070b8]">
                  {(customer.name || "NA").slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-bold text-[#1a3557]">{customer.name}</div>
                  <div className="truncate text-[11px] text-[#607d8b]">{customer.company || customer.contactPerson || "Customer record"}</div>
                  <div className="truncate text-[10px] text-[#90a4ae]">{customer.email || customer.phone || "No contact details"}</div>
                </div>
                <i className="fas fa-chevron-right text-[10px] text-[#90a4ae]" />
              </button>
            ))}
          </div>
        )}
      />
    </div>
  );
}
