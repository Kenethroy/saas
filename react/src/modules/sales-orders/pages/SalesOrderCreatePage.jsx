import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, useParams } from "react-router-dom";
import { DateField } from "@/shared/components/common/DateField";
import { FormModal } from "@/shared/components/common/FormModal";
import { SearchableSelect } from "@/shared/components/common/SearchableSelect";
import SelectionModal from "@/shared/components/common/SelectionModal";
import { Skeleton } from "@/shared/components/common/Skeleton";
import { useNotification } from "@/shared/hooks/useNotification";
import { getCategoryOptions } from "@/modules/categories/api/categories.api";
import { getCustomers } from "@/modules/customers/api/customers.api";
import { useEmployees } from "@/modules/employees/hooks/useEmployees";
import { getPaymentTerms } from "@/modules/payment-terms/api/payment-terms.api";
import { getProductVariantList, resolveProductImageUrl } from "@/modules/products/api/products.api";
import { createSalesOrder, getSalesOrderById, updateSalesOrder } from "@/modules/sales-orders/api/sales-orders.api";
import { canEditSalesOrder } from "@/modules/sales-orders/utils/status";

const discountTypeOptions = [
  { value: "none", label: "No Discount" },
  { value: "percentage", label: "Percentage" },
  { value: "fixed", label: "Fixed Amount" }
];

const salesOrderSchema = z.object({
  customerId: z.union([z.coerce.number().int().positive(), z.literal(""), z.null()]),
  orderDate: z.string().min(1, "Order date is required"),
  agentId: z.union([z.coerce.number().int().positive(), z.literal(""), z.null()]).optional(),
  paymentTermId: z.union([z.coerce.number().int().positive(), z.literal(""), z.null()]).optional(),
  discountType: z.enum(["none", "percentage", "fixed"]).default("none"),
  discountValue: z.coerce.number().min(0).default(0),
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

  value.items.forEach((item, index) => {
    if (!item.productVariantId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["items", index, "productVariantId"],
        message: "Product is required"
      });
    }
  });

  if (value.discountType === "percentage") {
    if (Number(value.discountValue) < 1 || Number(value.discountValue) > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["discountValue"],
        message: "Percentage discount must be between 1 and 100"
      });
    }
  }

  value.items.forEach((item, index) => {
    if (Number(item.discountPercent ?? 0) !== 0 && (Number(item.discountPercent) < 1 || Number(item.discountPercent) > 100)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["items", index, "discountPercent"],
        message: "Item discount must be between 1 and 100"
      });
    }
  });
});

const defaultValues = {
  customerId: "",
  orderDate: new Date().toISOString().slice(0, 10),
  agentId: "",
  paymentTermId: "",
  discountType: "none",
  discountValue: "",
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

function clampNumber(value, min, max) {
  if (value === "" || value === null || value === undefined || Number.isNaN(Number(value))) {
    return "";
  }

  const numericValue = Number(value);
  return Math.min(max, Math.max(min, numericValue));
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

function mapSalesOrderToFormValues(salesOrder) {
  return {
    customerId: salesOrder?.customerId ?? "",
    orderDate: salesOrder?.orderDate ? String(salesOrder.orderDate).slice(0, 10) : defaultValues.orderDate,
    agentId: salesOrder?.agentId ?? "",
    paymentTermId: salesOrder?.paymentTermId ?? "",
    discountType: salesOrder?.discountType ?? "none",
    discountValue: Number(salesOrder?.discountValue ?? 0),
    items: (salesOrder?.items ?? []).map((item) => ({
      productVariantId: item.productVariantId,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice ?? 0),
      discountPercent:
        Number(item.unitPrice ?? 0) > 0 && Number(item.quantity ?? 0) > 0
          ? Math.round((Number(item.lineDiscount ?? 0) / (Number(item.unitPrice) * Number(item.quantity))) * 100)
          : 0,
      productName: item.productName,
      variantName: item.variantName,
      onHandStock: Number(item.onHandStock ?? item.availableStock ?? 0),
      reservedStock: Number(item.reservedStock ?? 0),
      availableStock: Number(item.availableStock ?? 0)
    }))
  };
}

export function SalesOrderCreatePage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const notify = useNotification();
  const queryClient = useQueryClient();
  const [productSearchInput, setProductSearchInput] = useState("");
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [productCategoryFilter, setProductCategoryFilter] = useState("");
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [createdOrder, setCreatedOrder] = useState(null);
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
    resolver: zodResolver(salesOrderSchema),
    defaultValues
  });

  const { fields, append, remove, update } = useFieldArray({
    control,
    name: "items"
  });

  const {
    data: salesOrderResponse,
    isLoading: isSalesOrderLoading,
    isError: isSalesOrderError,
    error: salesOrderError
  } = useQuery({
    queryKey: ["sales-order", id],
    queryFn: () => getSalesOrderById(id),
    enabled: isEditMode
  });

  const { data: customersResponse, isLoading: isCustomersLoading, isFetching: isCustomersFetching, refetch: refetchCustomers } = useQuery({
    queryKey: ["sales-order-customers"],
    queryFn: () => getCustomers({ page: 1, perPage: 100, status: true })
  });

  const { data: paymentTermsResponse, isLoading: isPaymentTermsLoading } = useQuery({
    queryKey: ["sales-order-payment-terms"],
    queryFn: () => getPaymentTerms({ status: true })
  });

  const { data: categoriesResponse, isLoading: isCategoriesLoading } = useQuery({
    queryKey: ["sales-order-category-options"],
    queryFn: getCategoryOptions
  });

  const {
    data: productVariantsResponse,
    isLoading: isProductVariantsLoading,
    isFetching: isProductVariantsFetching
  } = useQuery({
    queryKey: ["sales-order-product-variants", productSearchTerm, productCategoryFilter, isEditMode ? id : "new"],
    queryFn: () =>
      getProductVariantList({
        context: "sales_order",
        ...(isEditMode ? { salesOrderId: id } : {}),
        ...(productSearchTerm ? { search: productSearchTerm } : {}),
        ...(productCategoryFilter ? { categoryId: productCategoryFilter } : {})
      }),
    placeholderData: (previousData) => previousData
  });

  const { data: agentsResponse, isLoading: isAgentsLoading } = useEmployees({
    page: 1,
    perPage: 100,
    position: "agent",
    status: "active"
  });

  const saveMutation = useMutation({
    mutationFn: (payload) => (isEditMode ? updateSalesOrder(id, payload) : createSalesOrder(payload)),
    onSuccess: async (response) => {
      if (isEditMode) {
        notify.success("Sales order updated successfully");
        reset(mapSalesOrderToFormValues(response.data));
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["sales-orders"] }),
          queryClient.invalidateQueries({ queryKey: ["sales-order", id] })
        ]);
        navigate(`/sales-orders/${id}`);
        return;
      }

      setCreatedOrder(response.data);
      notify.success("Sales order created successfully");
      reset(defaultValues);
      await queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
    }
  });

  const customers = customersResponse?.data ?? [];
  const paymentTerms = paymentTermsResponse?.data ?? [];
  const categories = categoriesResponse?.data ?? [];
  const productVariants = productVariantsResponse?.data ?? [];
  const agents = agentsResponse?.data ?? [];

  const watchedItems = watch("items");
  const orderDate = watch("orderDate");
  const customerId = watch("customerId");
  const discountType = watch("discountType");
  const discountValue = watch("discountValue");
  const salesOrder = salesOrderResponse?.data ?? null;
  const orderIsEditable = !isEditMode || canEditSalesOrder(salesOrder?.status);
  const selectedCustomer = customers.find((entry) => String(entry.id) === String(customerId ?? ""));
  const agentOptions = agents.map((agent) => ({
    value: agent.id,
    label: [agent.firstName, agent.lastName].filter(Boolean).join(" ") || agent.username || `Agent #${agent.id}`
  }));

  useEffect(() => {
    if (!isEditMode || !salesOrder) {
      return;
    }

    reset(mapSalesOrderToFormValues(salesOrder));
  }, [isEditMode, reset, salesOrder]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setProductSearchTerm(productSearchInput.trim());
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [productSearchInput]);

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
      onHandStock: Number(variant?.onHand ?? item.onHandStock ?? variant?.stock ?? item.availableStock ?? 0),
      reservedStock: Number(variant?.reserved ?? item.reservedStock ?? 0),
      availableStock: Number(variant?.available ?? item.availableStock ?? variant?.stock ?? 0),
      quantity,
      unitPrice,
      discountPercent,
      lineDiscount,
      lineSubtotal,
      lineTotal
    };
  });

  const grossSubtotal = cartRows.reduce((sum, row) => sum + (row.lineSubtotal ?? 0), 0);
  const itemDiscountTotal = cartRows.reduce((sum, row) => sum + (row.lineDiscount ?? 0), 0);
  const itemsSubtotal = cartRows.reduce((sum, row) => sum + row.lineTotal, 0);
  const discountAmount = Math.min(itemsSubtotal, computeDiscountAmount(discountType, discountValue, itemsSubtotal));
  const totalAmount = Math.max(0, itemsSubtotal - discountAmount);
  const cartStockShortages = cartRows
    .map((row, index) => ({
      index,
      ...row
    }))
    .filter((row) => Number(row.quantity ?? 0) > Number(row.availableStock ?? 0));
  const isProcessingEdit = isEditMode && salesOrder?.status === "processing";
  const shouldBlockProcessingEditSave = isProcessingEdit && cartStockShortages.length > 0;

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
      const maxStock = Number(variant.onHand ?? variant.stock ?? currentItem?.onHandStock ?? currentItem?.availableStock ?? 0);
      const nextQuantity = clampInteger(Number(currentItem?.quantity ?? 0) + 1, 1, Math.max(1, maxStock || 1));
      update(existingIndex, {
        ...currentItem,
        productVariantId: variant.id,
        quantity: nextQuantity,
        unitPrice: Number(currentItem?.unitPrice ?? variant.price),
        discountPercent: Number(currentItem?.discountPercent ?? 0),
        productName: currentItem?.productName ?? variant.productName,
        variantName: currentItem?.variantName ?? variant.name,
        onHandStock: currentItem?.onHandStock ?? variant.onHand ?? variant.stock,
        reservedStock: currentItem?.reservedStock ?? variant.reserved ?? 0,
        availableStock: currentItem?.availableStock ?? variant.available ?? variant.stock
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
      onHandStock: Number(variant.onHand ?? variant.stock ?? 0),
      reservedStock: Number(variant.reserved ?? 0),
      availableStock: Number(variant.available ?? variant.stock ?? 0)
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

    const maxStock = Number(cartRows[index]?.onHandStock ?? cartRows[index]?.availableStock ?? 0);
    const normalizedQuantity = clampInteger(quantity, 1, Math.max(1, maxStock || 1));

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
    setValue(`items.${index}.unitPrice`, Number(unitPrice), {
      shouldDirty: true,
      shouldValidate: true
    });
  }

  function updateCartDiscount(index, discountPercent) {
    const normalizedValue = normalizePercentInput(discountPercent);
    setValue(`items.${index}.discountPercent`, normalizedValue, {
      shouldDirty: true,
      shouldValidate: true
    });
  }

  function updateDiscountValue(value) {
    if (discountType === "percentage") {
      const normalizedValue = clampNumber(value, 1, 100);
      setValue("discountValue", normalizedValue, {
        shouldDirty: true,
        shouldValidate: true
      });
      return;
    }

    const normalizedValue = value === "" ? "" : Math.max(0, Number(value));
    setValue("discountValue", normalizedValue, {
      shouldDirty: true,
      shouldValidate: true
    });
  }

  async function onSubmit(values) {
    if (isEditMode && !orderIsEditable) {
      notify.error("Only pending or processing sales orders can be edited.");
      return;
    }

    if (shouldBlockProcessingEditSave) {
      notify.error("Resolve the available stock shortage before saving this processing sales order.");
      return;
    }

    const payload = {
      customerId: Number(values.customerId),
      orderDate: values.orderDate,
      agentId: values.agentId ? Number(values.agentId) : null,
      paymentTermId: values.paymentTermId ? Number(values.paymentTermId) : null,
      discountType: values.discountType,
      discountValue: Number(values.discountValue ?? 0),
      items: values.items.map((item) => ({
        productVariantId: Number(item.productVariantId),
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        discountPercent: Number(item.discountPercent ?? 0)
      }))
    };

    await saveMutation.mutateAsync(payload);
  }

  const formBusy = isSubmitting || saveMutation.isPending || isSalesOrderLoading;

  return (
    <div className="space-y-3">
      <section className="erp-page-section">
        <div className="erp-page-header">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/sales-orders")}
              className="erp-back-button"
              title="Back to Sales Orders"
            >
              <i className="fas fa-arrow-left text-[12px]" />
            </button>
            <div>
              <div className="erp-page-title">{isEditMode ? "Edit Sales Order" : "Create Sales Order"}</div>
              <div className="erp-page-description">
                {isEditMode
                  ? "Update the order while it is still pending or processing"
                  : "Select products on the left and build the order cart on the right"}
              </div>
            </div>
          </div>
        </div>
      </section>

      {isEditMode && isSalesOrderError ? (
        <section className="rounded-sm border border-[#ef9a9a] bg-[#fff5f5] px-4 py-3 text-[11px] text-[#c62828]">
          Failed to load sales order{salesOrderError?.message ? `: ${salesOrderError.message}` : "."}
        </section>
      ) : null}

      {isEditMode && salesOrder && !orderIsEditable ? (
        <section className="rounded-sm border border-[#ffe082] bg-[#fff8e1] px-4 py-3 text-[11px] text-[#8d6e00]">
          This sales order is now in <span className="font-bold">{salesOrder.status.replace("_", " ")}</span> status and can no longer be edited.
        </section>
      ) : null}

      {cartStockShortages.length > 0 ? (
        <section className={`px-4 py-3 text-[11px] ${shouldBlockProcessingEditSave ? "rounded-sm border border-[#ef9a9a] bg-[#fff5f5] text-[#c62828]" : "rounded-sm border border-[#ffe082] bg-[#fff8e1] text-[#8d6e00]"}`}>
          <div className="font-bold">
            {shouldBlockProcessingEditSave
              ? "This processing sales order has insufficient available stock."
              : "Some items are above currently available stock."}
          </div>
          <div className="mt-1">
            {shouldBlockProcessingEditSave
              ? "Reduce the quantity or replenish stock before saving a processing order."
              : "You can still save this order as pending, but it cannot move into processing until availability is resolved."}
          </div>
        </section>
      ) : null}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 erp-form-stack">
        <section className="erp-page-main-card p-3.5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                      {selectedCustomer.company || selectedCustomer.email || selectedCustomer.contactPerson || "Customer record"}
                    </span>
                  ) : null}
                </span>
                <i className="fas fa-search shrink-0 text-[11px] text-[#78909c]" />
              </button>
              {errors.customerId ? <p className="mt-1 text-[10px] text-[#c62828]">{errors.customerId.message}</p> : null}
            </div>

            <div>
              <DateField
                label="Order Date"
                name="orderDate"
                value={orderDate ?? ""}
                onChange={(nextValue) => {
                  setValue("orderDate", nextValue, {
                    shouldDirty: true,
                    shouldValidate: true
                  });
                }}
                error={errors.orderDate?.message}
              />
            </div>

            <div>
              <label className="erp-label">Agent</label>
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
            </div>

            <div>
              <label className="erp-label">Payment Term</label>
              <select {...register("paymentTermId")} className="erp-select" disabled={isPaymentTermsLoading}>
                <option value="">{isPaymentTermsLoading ? "Loading payment terms..." : "Cash / None"}</option>
                {paymentTerms.map((term) => (
                  <option key={term.id} value={term.id}>
                    {term.name} ({term.days} days)
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="grid gap-2 xl:grid-cols-2">
          <div className="app-shell-card">
            <div className="border-b border-[#e3ebf1] px-3 py-3">
              <div className="flex flex-col gap-2">
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
                          <Skeleton key={`cat-tab-sk-${index}`} className="h-8 w-24 rounded-sm" />
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

                <div className="relative min-w-[220px] flex-1">
                  <i className="fas fa-search pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#90a4ae]" />
                  <input
                    value={productSearchInput}
                    onChange={(event) => setProductSearchInput(event.target.value)}
                    placeholder="Search products..."
                    className="erp-input pl-7 pr-20"
                  />
                  {productSearchInput ? (
                    <button
                      type="button"
                      onClick={() => setProductSearchInput("")}
                      className="absolute right-5 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-sm text-[11px] text-[#78909c] transition hover:bg-[#eef5fa] hover:text-[#1a3557]"
                      aria-label="Clear product search"
                      title="Clear search"
                    >
                      <i className="fas fa-times" aria-hidden="true" />
                    </button>
                  ) : null}
                  {isProductVariantsFetching ? (
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-[#90a4ae]">
                      Searching...
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="p-3">
              <div className="max-h-[700px] overflow-y-auto pr-1">
                {isProductVariantsLoading ? (
                  <div className="grid grid-cols-2 gap-2.5">
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
                  <div className="flex min-h-[280px] items-center justify-center text-[11px] italic text-[#90a4ae]">
                    No sellable products found for the current filters.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    {productVariants.map((variant) => {
                      const isAdded = cartVariantIds.has(Number(variant.id));
                      const outOfStock = Number(variant.stock ?? 0) <= 0;

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
                              <div className="flex items-start justify-between gap-2">
                                <p className="truncate text-[11px] font-bold text-[#1a3557]">{variant.productName}</p>
                              </div>
                              <p className="mt-0.5 truncate text-[10px] text-[#607d8b]">{variant.name}</p>
                              <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[9px] text-[#90a4ae]">
                                <span>{variant.category || "Uncategorized"}</span>
                                <span>On hand {variant.onHand ?? variant.stock}</span>
                                <span>Reserved {variant.reserved ?? 0}</span>
                                <span className={Number(variant.available ?? 0) <= 0 ? "font-bold text-[#c62828]" : ""}>
                                  Available {variant.available ?? variant.stock}
                                </span>
                              </div>
                              <div className="mt-2 flex items-center justify-between gap-2">
                                <p className="text-[11px] font-bold text-[#0070b8]">{formatMoney(variant.price)}</p>
                                <button
                                  type="button"
                                  onClick={() => addProductToCart(variant)}
                                  disabled={outOfStock || isAdded}
                                  className={`inline-flex h-7 items-center justify-center rounded-sm px-2.5 text-[10px] font-bold transition disabled:cursor-not-allowed ${
                                    isAdded
                                      ? "border border-[#0070b8] bg-white text-[#0070b8] disabled:opacity-100"
                                      : "bg-[#0070b8] text-white hover:bg-[#005a94] disabled:bg-[#b0bec5] disabled:text-white"
                                  }`}
                                  title={isAdded ? "Already in cart" : outOfStock ? "Out of stock" : "Add to cart"}
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

          <aside className="app-shell-card">
            <section className="border-b border-[#e3ebf1] p-3">
              <div className="flex items-center gap-2 pb-3">
                <i className="fas fa-shopping-cart text-[13px] text-[#0070b8]" />
                <p className="text-[13px] font-bold text-[#1a3557]">Cart</p>
              </div>

              {fields.length === 0 ? (
                <div className="flex min-h-[220px] items-center justify-center text-[11px] italic text-[#90a4ae]">
                  Add products from the left panel to start this order.
                </div>
              ) : (
                <div className="mt-3 max-h-[510px] space-y-2 overflow-y-auto pr-1">
                  {fields.map((field, index) => {
                    const row = cartRows[index];
                    const maxStock = Number(row?.onHandStock ?? row?.availableStock ?? 0);
                    const maxQuantity = Math.max(1, maxStock || 1);
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
                              <span>On hand {row?.onHandStock ?? "-"}</span>
                              <span>Reserved {row?.reservedStock ?? 0}</span>
                              <span className={quantity > Number(row?.availableStock ?? 0) ? "font-bold text-[#c62828]" : ""}>
                                Available {row?.availableStock ?? "-"}
                              </span>
                              <span>{formatMoney(watchedItems?.[index]?.unitPrice ?? 0)} / unit</span>
                            </div>
                            {quantity > Number(row?.availableStock ?? 0) ? (
                              <p className="mt-1 text-[10px] font-semibold text-[#c62828]">
                                Requested quantity is above available stock after processing reservations.
                              </p>
                            ) : null}
                          </div>

                          <div className="flex shrink-0 flex-col gap-[3px]">
                            <span className="text-[9px] font-bold uppercase tracking-[0.3px] text-[#90a4ae]">Qty</span>
                            <div className="flex items-center overflow-hidden rounded-sm border border-[#d3dee7] bg-white">
                              <button
                                type="button"
                                onClick={() => updateCartQuantity(index, quantity - 1)}
                                disabled={quantity <= 1}
                                className="inline-flex h-[26px] w-[26px] items-center justify-center border-r border-[#d3dee7] bg-[#f3f6f9] text-[10px] text-[#546e7a] transition hover:bg-[#e8f1f8] hover:text-[#0070b8] disabled:cursor-not-allowed disabled:bg-[#f9fafc] disabled:text-[#b0bec5]"
                                title="Decrease quantity"
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
                                disabled={quantity >= maxQuantity}
                                className="inline-flex h-[26px] w-[26px] items-center justify-center border-l border-[#d3dee7] bg-[#f3f6f9] text-[10px] text-[#546e7a] transition hover:bg-[#e8f1f8] hover:text-[#0070b8] disabled:cursor-not-allowed disabled:bg-[#f9fafc] disabled:text-[#b0bec5]"
                                title="Increase quantity"
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
                              placeholder="0"
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

              <div className="mt-4">
                <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-2">
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
                      value={discountValue ?? ""}
                      onChange={(event) => updateDiscountValue(event.target.value)}
                      onFocus={(event) => event.target.select()}
                      className="erp-input"
                      placeholder={discountType === "percentage" ? "1-100" : "0.00"}
                    />
                  </div>
                </div>
                {errors.discountValue ? (
                  <p className="mt-1 text-[10px] text-[#c62828]">{errors.discountValue.message}</p>
                ) : null}
              </div>

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
                  <span className="text-[#607d8b]">
                    Discount
                    {discountType === "percentage" && Number(discountValue)
                      ? ` (${Number(discountValue)}%)`
                      : discountType === "fixed" && Number(discountValue)
                        ? " (Fixed)"
                        : ""}
                  </span>
                  <span className="font-bold text-[#1a3557]">- {formatMoney(discountAmount)}</span>
                </div>
                <div className="mt-3 border-t border-[#e3ebf1] pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-bold text-[#1a3557]">Total Amount</span>
                    <span className="text-[16px] font-bold text-[#0070b8]">{formatMoney(totalAmount)}</span>
                  </div>
                </div>
              </div>

              {saveMutation.isError ? (
                <div className="mt-4 rounded-sm border border-[#ef9a9a] bg-[#fff5f5] px-3 py-2.5 text-[11px] text-[#c62828]">
                  Failed to {isEditMode ? "update" : "create"} sales order
                  {saveMutation.error?.response?.data?.message ? `: ${saveMutation.error.response.data.message}` : "."}
                </div>
              ) : null}

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => navigate("/sales-orders")}
                  className="erp-button-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formBusy || !orderIsEditable || shouldBlockProcessingEditSave}
                  className="erp-button-primary flex-1"
                >
                  {formBusy ? "Saving..." : isEditMode ? "Update Sales Order" : "Create Sales Order"}
                </button>
              </div>
            </section>
          </aside>
        </section>
      </form>

      <SelectionModal
        show={showCustomerModal}
        title="Select Customer"
        subtitle="Search and choose the customer for this sales order."
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

      <FormModal
        show={Boolean(createdOrder)}
        title="Sales Order Created"
        size="lg"
        onClose={() => {
          setCreatedOrder(null);
          navigate("/sales-orders");
        }}
      >
        <div className="space-y-5">
          <p className="text-[10px] text-[#546e7a]">
            The sales order has been created successfully. You can use this reference for the next delivery and invoicing steps.
          </p>

          <div className="space-y-3 rounded-sm border border-[#d3dee7] bg-[#f8fbfd] p-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.5px] text-[#607d8b]">Sales Order Number</p>
              <div className="mt-1 rounded-sm border border-[#d3dee7] bg-white px-3 py-2 font-mono text-[12px] text-[#1a3557]">
                {createdOrder?.salesOrderNumber}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.5px] text-[#607d8b]">Customer</p>
                <div className="mt-1 rounded-sm border border-[#d3dee7] bg-white px-3 py-2 text-[12px] text-[#1a3557]">
                  {createdOrder?.customer?.name}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.5px] text-[#607d8b]">Total Amount</p>
                <div className="mt-1 rounded-sm border border-[#d3dee7] bg-white px-3 py-2 text-[12px] font-bold text-[#1a3557]">
                  {formatMoney(createdOrder?.totalAmount)}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setCreatedOrder(null);
                navigate("/sales-orders");
              }}
              className="erp-button-primary"
            >
              Back to List
            </button>
          </div>
        </div>
      </FormModal>
    </div>
  );
}
