import { useDeferredValue, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { DateField } from "@/shared/components/common/DateField";
import { FormModal } from "@/shared/components/common/FormModal";
import { Skeleton } from "@/shared/components/common/Skeleton";
import SelectionModal from "@/shared/components/common/SelectionModal";
import { useNotification } from "@/shared/hooks/useNotification";
import { getCategoryOptions } from "@/modules/categories/api/categories.api";
import { getSuppliers } from "@/modules/suppliers/api/suppliers.api";
import { getPaymentTerms } from "@/modules/payment-terms/api/payment-terms.api";
import { getProductVariantList, resolveProductImageUrl } from "@/modules/products/api/products.api";
import { createPurchaseOrder, getPurchaseOrderById, updatePurchaseOrder } from "@/modules/purchase-orders/api/purchase-orders.api";
import { canEditPurchaseOrder } from "@/modules/purchase-orders/utils/status";

const purchaseOrderSchema = z.object({
  supplierId: z.union([z.coerce.number().int().positive(), z.literal(""), z.null()]),
  orderDate: z.string().min(1, "Order date is required"),
  expectedDate: z.string().optional().nullable().or(z.literal("")),
  paymentTermId: z.union([z.coerce.number().int().positive(), z.literal(""), z.null()]).optional(),
  items: z.array(
    z.object({
      productVariantId: z.union([z.coerce.number().int().positive(), z.literal(""), z.null()]),
      quantity: z.coerce.number().int().positive("Quantity must be at least 1"),
      unitCost: z.coerce.number().min(0, "Unit cost cannot be negative"),
      productName: z.string().optional(),
      variantName: z.string().optional(),
      availableStock: z.coerce.number().optional()
    })
  ).min(1, "At least one item is required")
}).superRefine((value, ctx) => {
  if (!value.supplierId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["supplierId"],
      message: "Supplier is required"
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
});

const defaultValues = {
  supplierId: "",
  orderDate: new Date().toISOString().slice(0, 10),
  expectedDate: "",
  paymentTermId: "",
  items: []
};

function formatMoney(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2
  }).format(Number(value ?? 0));
}

function clampInteger(value, min, max) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return min;
  }

  return Math.min(max, Math.max(min, Math.trunc(numericValue)));
}

function mapPurchaseOrderToFormValues(purchaseOrder) {
  return {
    supplierId: purchaseOrder?.supplierId ?? "",
    orderDate: purchaseOrder?.orderDate ? String(purchaseOrder.orderDate).slice(0, 10) : defaultValues.orderDate,
    expectedDate: purchaseOrder?.expectedDate ? String(purchaseOrder.expectedDate).slice(0, 10) : "",
    paymentTermId: purchaseOrder?.paymentTermId ?? "",
    items: (purchaseOrder?.items ?? []).map((item) => ({
      productVariantId: item.productVariantId,
      quantity: item.quantity,
      unitCost: Number(item.unitCost ?? 0),
      productName: item.productName,
      variantName: item.variantName,
      availableStock: Number(item.availableStock ?? item.productVariant?.stockQuantity ?? 0)
    }))
  };
}

export function PurchaseOrderCreatePage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const notify = useNotification();
  const queryClient = useQueryClient();
  const [productSearchInput, setProductSearchInput] = useState("");
  const [productCategoryFilter, setProductCategoryFilter] = useState("");
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [createdOrder, setCreatedOrder] = useState(null);
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
    resolver: zodResolver(purchaseOrderSchema),
    defaultValues
  });

  const { fields, append, remove, update } = useFieldArray({
    control,
    name: "items"
  });

  const {
    data: purchaseOrderResponse,
    isLoading: isPurchaseOrderLoading,
    isError: isPurchaseOrderError,
    error: purchaseOrderError
  } = useQuery({
    queryKey: ["purchase-order", id],
    queryFn: () => getPurchaseOrderById(id),
    enabled: isEditMode
  });

  const {
    data: suppliersResponse,
    isLoading: isSuppliersLoading,
    isFetching: isSuppliersFetching,
    refetch: refetchSuppliers
  } = useQuery({
    queryKey: ["purchase-order-suppliers"],
    queryFn: () => getSuppliers({ page: 1, limit: 200, status: 1 })
  });

  const { data: paymentTermsResponse, isLoading: isPaymentTermsLoading } = useQuery({
    queryKey: ["purchase-order-payment-terms"],
    queryFn: () => getPaymentTerms({ status: true })
  });

  const { data: categoriesResponse, isLoading: isCategoriesLoading } = useQuery({
    queryKey: ["purchase-order-category-options"],
    queryFn: getCategoryOptions
  });

  const { data: productVariantsResponse, isLoading: isProductVariantsLoading } = useQuery({
    queryKey: ["purchase-order-product-variants", deferredProductSearch, productCategoryFilter],
    queryFn: () =>
      getProductVariantList({
        ...(deferredProductSearch ? { search: deferredProductSearch } : {}),
        ...(productCategoryFilter ? { categoryId: productCategoryFilter } : {}),
        context: "purchase_order"
      })
  });

  const saveMutation = useMutation({
    mutationFn: (payload) => (isEditMode ? updatePurchaseOrder(id, payload) : createPurchaseOrder(payload)),
    onSuccess: async (response) => {
      const savedPurchaseOrder = response?.data ?? response;

      if (isEditMode) {
        notify.success("Purchase order updated successfully");
        reset(mapPurchaseOrderToFormValues(savedPurchaseOrder));
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["purchase-orders"] }),
          queryClient.invalidateQueries({ queryKey: ["purchase-order", id] })
        ]);
        navigate(`/purchase-orders/${id}`);
        return;
      }

      setCreatedOrder(savedPurchaseOrder);
      notify.success("Purchase order created successfully");
      reset(defaultValues);
      await queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
    }
  });

  const suppliers = suppliersResponse?.data ?? [];
  const paymentTerms = paymentTermsResponse?.data ?? [];
  const categories = categoriesResponse?.data ?? [];
  const productVariants = productVariantsResponse?.data ?? [];

  const watchedItems = watch("items");
  const supplierId = watch("supplierId");
  const orderDate = watch("orderDate");
  const expectedDate = watch("expectedDate");
  const purchaseOrder = purchaseOrderResponse?.data ?? purchaseOrderResponse ?? null;
  const orderIsEditable = !isEditMode || canEditPurchaseOrder(purchaseOrder?.status);
  const selectedSupplier = suppliers.find((entry) => String(entry.id) === String(supplierId ?? ""));
  const supplierQueryId = searchParams.get("supplier");

  useEffect(() => {
    if (!isEditMode || !purchaseOrder) {
      return;
    }

    reset(mapPurchaseOrderToFormValues(purchaseOrder));
  }, [isEditMode, reset, purchaseOrder]);

  useEffect(() => {
    if (isEditMode || !supplierQueryId || supplierId) {
      return;
    }

    const matchedSupplier = suppliers.find((entry) => String(entry.id) === String(supplierQueryId));
    if (!matchedSupplier) {
      return;
    }

    handleSupplierChange(matchedSupplier.id);
  }, [isEditMode, supplierId, supplierQueryId, suppliers]);

  const cartVariantIds = new Set(
    (watchedItems ?? [])
      .map((item) => Number(item?.productVariantId))
      .filter((id) => Number.isFinite(id) && id > 0)
  );

  const cartRows = (watchedItems ?? []).map((item) => {
    const variant = productVariants.find((entry) => entry.id === Number(item.productVariantId)) ?? null;
    const quantity = Number(item.quantity ?? 0);
    const unitCost = Number(item.unitCost ?? 0);
    const lineTotal = quantity * unitCost;

    return {
      variant,
      productName: variant?.productName || item.productName || "Product",
      variantName: variant?.name || item.variantName || "Variant",
      availableStock: variant?.stock ?? item.availableStock ?? null,
      quantity,
      unitCost,
      lineTotal
    };
  });

  const totalAmount = cartRows.reduce((sum, row) => sum + row.lineTotal, 0);

  function handleSupplierChange(supplierIdValue) {
    setValue("supplierId", supplierIdValue, {
      shouldDirty: true,
      shouldValidate: true
    });

    const supplier = suppliers.find((entry) => entry.id === Number(supplierIdValue));
    if (supplier?.paymentTermId) {
      setValue("paymentTermId", supplier.paymentTermId, {
        shouldDirty: true,
        shouldValidate: true
      });
    }
  }

  function handleSelectSupplier(supplier) {
    handleSupplierChange(supplier.id);
    setShowSupplierModal(false);
  }

  function addProductToCart(variant) {
    const existingIndex = fields.findIndex((field) => Number(field.productVariantId) === Number(variant.id));

    if (existingIndex >= 0) {
      const currentItem = watchedItems?.[existingIndex];
      const maxQuantity = 9999;
      const nextQuantity = clampInteger(Number(currentItem?.quantity ?? 0) + 1, 1, maxQuantity);
      update(existingIndex, {
        ...currentItem,
        productVariantId: variant.id,
        quantity: nextQuantity,
        unitCost: Number(currentItem?.unitCost ?? variant.unitCost ?? variant.price),
        productName: currentItem?.productName ?? variant.productName,
        variantName: currentItem?.variantName ?? variant.name,
        availableStock: currentItem?.availableStock ?? variant.stock
      });
      return;
    }

    append({
      productVariantId: variant.id,
      quantity: 1,
      unitCost: Number(variant.unitCost ?? variant.price),
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

    const normalizedQuantity = clampInteger(quantity, 1, 9999);

    setValue(`items.${index}.quantity`, Number(normalizedQuantity), {
      shouldDirty: true,
      shouldValidate: true
    });
  }

  function finalizeCartQuantity(index, quantity) {
    const nextQuantity = quantity === "" ? 1 : quantity;
    updateCartQuantity(index, nextQuantity);
  }

  function updateCartPrice(index, unitCost) {
    setValue(`items.${index}.unitCost`, Number(unitCost), {
      shouldDirty: true,
      shouldValidate: true
    });
  }

  async function onSubmit(values) {
    if (isEditMode && !orderIsEditable) {
      notify.error("Only pending purchase orders can be edited.");
      return;
    }

    const payload = {
      supplierId: Number(values.supplierId),
      orderDate: values.orderDate,
      expectedDate: values.expectedDate ? values.expectedDate : null,
      paymentTermId: values.paymentTermId ? Number(values.paymentTermId) : null,
      discountType: "none",
      discountValue: 0,
      items: values.items.map((item) => ({
        productVariantId: Number(item.productVariantId),
        quantity: Number(item.quantity),
        unitCost: Number(item.unitCost),
        discountPercent: 0
      }))
    };

    await saveMutation.mutateAsync(payload);
  }

  const formBusy = isSubmitting || saveMutation.isPending || isPurchaseOrderLoading;

  return (
    <div className="space-y-3">
      <section className="erp-page-section">
        <div className="erp-page-header">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/purchase-orders")}
              className="erp-back-button"
              title="Back to Purchase Orders"
            >
              <i className="fas fa-arrow-left text-[12px]" />
            </button>
            <div>
              <div className="erp-page-title">{isEditMode ? "Edit Purchase Order" : "Create Purchase Order"}</div>
              <div className="erp-page-description">
                {isEditMode
                  ? "Update the order while it is still pending"
                  : "Select products on the left and build the purchase order cart on the right"}
              </div>
            </div>
          </div>
        </div>
      </section>

      {isEditMode && isPurchaseOrderError ? (
        <section className="rounded-sm border border-[#ef9a9a] bg-[#fff5f5] px-4 py-3 text-[11px] text-[#c62828]">
          Failed to load purchase order{purchaseOrderError?.message ? `: ${purchaseOrderError.message}` : "."}
        </section>
      ) : null}

      {isEditMode && purchaseOrder && !orderIsEditable ? (
        <section className="rounded-sm border border-[#ffe082] bg-[#fff8e1] px-4 py-3 text-[11px] text-[#8d6e00]">
          This purchase order is now in <span className="font-bold">{purchaseOrder.status.replace("_", " ")}</span> status and can no longer be edited.
        </section>
      ) : null}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 erp-form-stack">
        <section className="erp-page-main-card p-3.5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="erp-label">Supplier</label>
              <button
                type="button"
                onClick={() => setShowSupplierModal(true)}
                disabled={isSuppliersLoading}
                className={`erp-select flex h-auto min-h-[36px] items-center justify-between gap-3 text-left ${
                  errors.supplierId ? "erp-input-error" : ""
                } ${isSuppliersLoading ? "cursor-not-allowed opacity-70" : ""}`}
              >
                <span className="min-w-0">
                  <span className={`block truncate ${selectedSupplier ? "text-[#1d2730]" : "text-[#90a4ae]"}`}>
                    {isSuppliersLoading ? "Loading suppliers..." : selectedSupplier?.name ?? "Select supplier"}
                  </span>
                  {selectedSupplier ? (
                    <span className="mt-0.5 block truncate text-[10px] text-[#78909c]">
                      {selectedSupplier.contactPerson || selectedSupplier.email || selectedSupplier.phone || "Supplier record"}
                    </span>
                  ) : null}
                </span>
                <i className="fas fa-search shrink-0 text-[11px] text-[#78909c]" />
              </button>
              {errors.supplierId ? <p className="mt-1 text-[10px] text-[#c62828]">{errors.supplierId.message}</p> : null}
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
              <DateField
                label="Expected Date"
                name="expectedDate"
                value={expectedDate ?? ""}
                onChange={(nextValue) => {
                  setValue("expectedDate", nextValue, {
                    shouldDirty: true,
                    shouldValidate: true
                  });
                }}
                error={errors.expectedDate?.message}
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
                    className="erp-input pl-7"
                  />
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
                              <p className="mt-1 text-[9px] text-[#90a4ae]">
                                {variant.category || "Uncategorized"} | Stock {variant.stock}
                              </p>
                              <div className="mt-2 flex items-center justify-between gap-2">
                                <p className="text-[11px] font-bold text-[#0070b8]">{formatMoney(variant.unitCost ?? variant.price)}</p>
                                <button
                                  type="button"
                                  onClick={() => addProductToCart(variant)}
                                  disabled={isAdded}
                                  className={`inline-flex h-7 items-center justify-center rounded-sm px-2.5 text-[10px] font-bold transition disabled:cursor-not-allowed ${
                                    isAdded
                                      ? "border border-[#0070b8] bg-white text-[#0070b8] disabled:opacity-100"
                                      : "bg-[#0070b8] text-white hover:bg-[#005a94] disabled:bg-[#b0bec5] disabled:text-white"
                                  }`}
                                  title={isAdded ? "Already in cart" : "Add to cart"}
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
                    const maxQuantity = 9999;
                    const quantityInputValue = watchedItems?.[index]?.quantity ?? 1;
                    const quantity = quantityInputValue === "" ? 0 : Number(quantityInputValue ?? 1);
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
                              <span>{formatMoney(watchedItems?.[index]?.unitCost ?? 0)} / unit</span>
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

                          <div className="min-w-[86px] shrink-0">
                            <div className="text-[9px] font-bold uppercase tracking-[0.3px] text-[#90a4ae]">Total</div>
                            <div className="mt-[3px] text-right">
                              <div className="text-[12px] font-bold text-[#0070b8]">{formatMoney(row?.lineTotal ?? 0)}</div>
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
                            {itemErrors.unitCost?.message ? <span>{itemErrors.unitCost.message}</span> : null}
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

              <div className="mt-4 border-t border-[#e3ebf1] pt-4 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold text-[#1a3557]">Total Amount</span>
                  <span className="text-[16px] font-bold text-[#0070b8]">{formatMoney(totalAmount)}</span>
                </div>
              </div>

              {saveMutation.isError ? (
                <div className="mt-4 rounded-sm border border-[#ef9a9a] bg-[#fff5f5] px-3 py-2.5 text-[11px] text-[#c62828]">
                  Failed to {isEditMode ? "update" : "create"} purchase order
                  {saveMutation.error?.response?.data?.message ? `: ${saveMutation.error.response.data.message}` : "."}
                </div>
              ) : null}

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => navigate("/purchase-orders")}
                  className="erp-button-secondary flex-1"
                >
                  Cancel
                </button>
                <button type="submit" disabled={formBusy || !orderIsEditable} className="erp-button-primary flex-1">
                  {formBusy ? "Saving..." : isEditMode ? "Update Purchase Order" : "Create Purchase Order"}
                </button>
              </div>
            </section>
          </aside>
        </section>
      </form>

      <SelectionModal
        show={showSupplierModal}
        title="Select Supplier"
        subtitle="Search and choose the supplier for this purchase order."
        searchPlaceholder="Search supplier by name, contact, or email..."
        items={suppliers}
        searchFields={["name", "contactPerson", "email", "phone"]}
        onClose={() => setShowSupplierModal(false)}
        onSelect={handleSelectSupplier}
        onRefresh={() => refetchSuppliers()}
        refreshing={isSuppliersFetching}
        size="3xl"
        renderItems={({ filteredItems, selectItem }) => (
          <div className="flex flex-col">
            {filteredItems.map((supplier) => (
              <button
                key={supplier.id}
                type="button"
                onClick={() => selectItem(supplier)}
                className="flex items-center gap-3 border-b border-[#edf2f6] px-4 py-3 text-left transition hover:bg-[#f6fbff]"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e8f1f8] text-[12px] font-bold text-[#0070b8]">
                  {(supplier.name || "NA").slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-bold text-[#1a3557]">{supplier.name}</div>
                  <div className="truncate text-[11px] text-[#607d8b]">{supplier.contactPerson || "Supplier record"}</div>
                  <div className="truncate text-[10px] text-[#90a4ae]">{supplier.email || supplier.phone || "No contact details"}</div>
                </div>
                <i className="fas fa-chevron-right text-[10px] text-[#90a4ae]" />
              </button>
            ))}
          </div>
        )}
      />

      <FormModal
        show={Boolean(createdOrder)}
        title="Purchase Order Created"
        size="lg"
        onClose={() => {
          setCreatedOrder(null);
          navigate("/purchase-orders");
        }}
      >
        <div className="space-y-5">
          <p className="text-[10px] text-[#546e7a]">
            The purchase order has been created successfully. You can use this reference for the next delivery logic.
          </p>

          <div className="space-y-3 rounded-sm border border-[#d3dee7] bg-[#f8fbfd] p-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.5px] text-[#607d8b]">Purchase Order Number</p>
              <div className="mt-1 rounded-sm border border-[#d3dee7] bg-white px-3 py-2 font-mono text-[12px] text-[#1a3557]">
                {createdOrder?.poNumber}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.5px] text-[#607d8b]">Supplier</p>
                <div className="mt-1 rounded-sm border border-[#d3dee7] bg-white px-3 py-2 text-[12px] text-[#1a3557]">
                  {createdOrder?.supplier?.name}
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
                navigate("/purchase-orders");
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
