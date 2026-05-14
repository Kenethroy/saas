import { useDeferredValue, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ConfirmationModal } from "@/shared/components/common/ConfirmationModal";
import { FormModal } from "@/shared/components/common/FormModal";
import { Pagination } from "@/shared/components/common/Pagination";
import { Skeleton, TableSkeleton } from "@/shared/components/common/Skeleton";
import { useNotification } from "@/shared/hooks/useNotification";
import { useCategoryOptions } from "@/modules/categories/hooks/useCategoryOptions";
import {
  createProduct,
  createProductVariant,
  deleteProductVariant,
  deleteUploadedProductImage,
  getProductBrochurePdf,
  resolveProductImageUrl,
  updateProduct,
  updateProductVariant,
  uploadProductImage
} from "@/modules/products/api/products.api";
import { useProducts } from "@/modules/products/hooks/useProducts";

const PRODUCT_PLACEHOLDER = "/placeholder.png";

const variantSchema = z.object({
  id: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : Number(val)),
    z.number().int().positive().optional()
  ),
  name: z.string().trim().optional(),
  unitCost: z.coerce.number().nonnegative("Cost must be zero or more"),
  unitPrice: z.coerce.number().nonnegative("Price must be zero or more"),
  stockQuantity: z.coerce.number().int().nonnegative("Stock must be zero or more").optional(),
  reorderLevel: z.coerce.number().int().nonnegative("Reorder level must be zero or more"),
  status: z.boolean().default(true)
});

const productFormSchema = z.object({
  categoryId: z.coerce.number().int().positive("Category is required"),
  name: z.string().trim().min(1, "Product family name is required"),
  fileUrl: z.string().trim().optional(),
  status: z.boolean().default(true),
  hasVariants: z.boolean().default(false),
  variants: z.array(variantSchema).min(1, "At least one variant is required")
}).superRefine((data, ctx) => {
  if (data.hasVariants) {
    data.variants.forEach((v, i) => {
      if (!v.name || v.name.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Variant name is required for multi-variant products",
          path: ["variants", i, "name"],
        });
      }
    });
  }
});

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

const defaultVariant = {
  id: undefined,
  name: "",
  unitCost: 0,
  unitPrice: 0,
  stockQuantity: 0,
  reorderLevel: 0,
  status: true
};

const defaultFormValues = {
  categoryId: "",
  name: "",
  fileUrl: "",
  status: true,
  hasVariants: false,
  variants: [{ ...defaultVariant }]
};

function toVariantDefaults(variant) {
  return {
    id: variant?.id,
    name: variant?.name ?? "",
    unitCost: Number(variant?.unitCost ?? 0),
    unitPrice: Number(variant?.unitPrice ?? 0),
    stockQuantity: Number(variant?.stockQuantity ?? 0),
    reorderLevel: Number(variant?.reorderLevel ?? 0),
    status: variant?.status ?? true
  };
}

export function ProductsPage() {
  const [searchParams] = useSearchParams();
  const externalSearch = (searchParams.get("search") ?? "").trim();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState(externalSearch);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [isBrochureDownloading, setIsBrochureDownloading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploadedFileUrl, setUploadedFileUrl] = useState("");
  const [variantDeleteTarget, setVariantDeleteTarget] = useState(null);
  const imageInputRef = useRef(null);
  const deferredSearch = useDeferredValue(searchInput.trim());
  const queryClient = useQueryClient();
  const notify = useNotification();

  const { data, isLoading, isError, error, isFetching } = useProducts({
    page,
    perPage: 10,
    ...(deferredSearch ? { search: deferredSearch } : {}),
    ...(selectedCategory ? { categoryId: Number(selectedCategory) } : {}),
    ...(statusFilter !== "" ? { status: statusFilter === "1" } : {})
  });
  const { data: categoriesResponse, isLoading: categoriesLoading } = useCategoryOptions();

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(productFormSchema),
    defaultValues: defaultFormValues
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "variants",
    keyName: "fieldKey"
  });

  const createMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      notify.success("Product created successfully");
      resetFormState();
      setShowForm(false);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ productId, payload, variants, hasVariants }) => {
      await updateProduct(productId, payload);

      await Promise.all(
        variants.map((variant) => {
          const variantPayload = {
            name: hasVariants ? variant.name : "",
            unitCost: Number(variant.unitCost),
            unitPrice: Number(variant.unitPrice),
            reorderLevel: Number(variant.reorderLevel),
            status: variant.status ?? true
          };

          if (variant.id) {
            return updateProductVariant(variant.id, variantPayload);
          }

          return createProductVariant(productId, {
            ...variantPayload,
            stockQuantity: Number(variant.stockQuantity ?? 0),
            status: variant.status ?? true
          });
        })
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      notify.success("Product updated successfully");
      resetFormState();
      setShowForm(false);
    }
  });

  const uploadImageMutation = useMutation({
    mutationFn: ({ file, productName }) => uploadProductImage(file, productName),
    onSuccess: (response) => {
      const fileUrl = response?.data?.fileUrl ?? "";
      setUploadedFileUrl(fileUrl);
      setImagePreview(fileUrl || null);
      setValue("fileUrl", fileUrl, {
        shouldDirty: true,
        shouldValidate: false
      });
      notify.success("Product image uploaded successfully");
    }
  });

  const deleteUploadedImageMutation = useMutation({
    mutationFn: deleteUploadedProductImage
  });

  const deleteVariantMutation = useMutation({
    mutationFn: deleteProductVariant,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      notify.success("Variant removed successfully");
    }
  });

  const rows = data?.data ?? [];
  const meta = data?.meta;
  const categories = categoriesResponse?.data ?? [];
  const productStatus = watch("status");

  useEffect(() => {
    setPage(1);
    setSearchInput(externalSearch);
  }, [externalSearch]);

  function resetFormState() {
    reset(defaultFormValues);
    createMutation.reset();
    updateMutation.reset();
    uploadImageMutation.reset();
    deleteVariantMutation.reset();
    setImagePreview(null);
    setUploadedFileUrl("");
    setEditingProduct(null);
    setIsEditMode(false);
    setVariantDeleteTarget(null);
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  }

  async function cleanupTemporaryImage(fileUrl, options = {}) {
    if (!fileUrl) {
      return;
    }

    try {
      await deleteUploadedImageMutation.mutateAsync(fileUrl);
      if (options.notify) {
        notify.info("Temporary product image removed");
      }
    } catch {
      // Ignore cleanup errors. This should not block the form.
    }
  }

  async function closeForm() {
    const pendingFileUrl = uploadedFileUrl;
    resetFormState();
    setShowForm(false);
    await cleanupTemporaryImage(pendingFileUrl, { notify: true });
  }

  function openCreateForm() {
    resetFormState();
    setShowForm(true);
  }

  function clearFilters() {
    setPage(1);
    setSearchInput("");
    setSelectedCategory("");
    setStatusFilter("");
  }

  async function resolveBlobErrorMessage(error) {
    const responseData = error?.response?.data;

    if (responseData instanceof Blob) {
      try {
        const text = await responseData.text();
        if (!text) return "Failed to download brochure.";
        try {
          const parsed = JSON.parse(text);
          return parsed?.message ?? text;
        } catch {
          return text;
        }
      } catch {
        return "Failed to download brochure.";
      }
    }

    return error?.response?.data?.message ?? error?.message ?? "Failed to download brochure.";
  }

  async function handleDownloadBrochure() {
    if (isBrochureDownloading) return;

    setIsBrochureDownloading(true);
    try {
      const pdfBlob = await getProductBrochurePdf();
      const normalizedBlob = pdfBlob instanceof Blob ? pdfBlob : new Blob([pdfBlob], { type: "application/pdf" });

      if (normalizedBlob.size === 0) {
        throw new Error("Brochure PDF is empty.");
      }

      const blobUrl = URL.createObjectURL(normalizedBlob);
      const filename = `product-price-list-${new Date().toISOString().slice(0, 10)}.pdf`;
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 5 * 60_000);
      notify.success("Brochure downloaded");
    } catch (downloadError) {
      const message = await resolveBlobErrorMessage(downloadError);
      notify.error(message);
    } finally {
      setIsBrochureDownloading(false);
    }
  }

  function openEditForm(product) {
    const values = {
      categoryId: product.categoryId ?? "",
      name: product.name ?? "",
      fileUrl: product.fileUrl ?? "",
      status: product.status ?? true,
      hasVariants: (product.variants?.length > 1) || (product.variants?.[0]?.name !== ""),
      variants: product.variants?.length ? product.variants.map(toVariantDefaults) : [{ ...defaultVariant }]
    };

    reset(values);
    setEditingProduct(product);
    setIsEditMode(true);
    setImagePreview(product.fileUrl ?? null);
    setUploadedFileUrl("");
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
    setShowForm(true);
  }

  function handleVariantRemoveClick(index) {
    const variant = fields[index];

    if (fields.length <= 1) {
      notify.warning("Keep at least one variant. Mark it inactive or delete the product instead.");
      return;
    }

    if (!variant?.id) {
      remove(index);
      return;
    }

    setVariantDeleteTarget({
      id: variant.id,
      index,
      name: variant.name || `Variant #${index + 1}`
    });
  }

  async function confirmVariantDelete() {
    if (!variantDeleteTarget) {
      return;
    }

    await deleteVariantMutation.mutateAsync(variantDeleteTarget.id);
    remove(variantDeleteTarget.index);
    setVariantDeleteTarget(null);
  }

  async function onSubmit(values) {
    const parentPayload = {
      categoryId: values.categoryId,
      name: values.name,
      fileUrl: values.fileUrl?.trim() || null,
      status: values.status,
      hasVariants: values.hasVariants
    };

    if (isEditMode && editingProduct) {
      await updateMutation.mutateAsync({
        productId: editingProduct.id,
        payload: parentPayload,
        variants: values.variants,
        hasVariants: values.hasVariants
      });
      return;
    }

    await createMutation.mutateAsync({
      ...parentPayload,
      hasVariants: values.hasVariants,
      variants: values.variants.map((variant) => ({
        name: values.hasVariants ? variant.name : "",
        unitCost: Number(variant.unitCost),
        unitPrice: Number(variant.unitPrice),
        stockQuantity: Number(variant.stockQuantity ?? 0),
        reorderLevel: Number(variant.reorderLevel),
        status: variant.status
      }))
    });
  }

  async function handleImageUpload(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const previousFileUrl = uploadedFileUrl;
    const productName = watch("name")?.trim?.() ?? "";

    try {
      await uploadImageMutation.mutateAsync({ file, productName });
      await cleanupTemporaryImage(previousFileUrl);
    } catch {
      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
    }
  }

  async function removeUploadedImage() {
    const pendingFileUrl = uploadedFileUrl;
    setImagePreview(null);
    setUploadedFileUrl("");
    setValue("fileUrl", "", {
      shouldDirty: true,
      shouldValidate: false
    });

    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }

    await cleanupTemporaryImage(pendingFileUrl);
  }

  const formBusy =
    isSubmitting ||
    createMutation.isPending ||
    updateMutation.isPending ||
    uploadImageMutation.isPending ||
    deleteVariantMutation.isPending;

  return (
    <div className="space-y-4">
      <section className="erp-page-section">
        <div className="erp-page-header">
          <div className="flex items-center gap-3">
            <i className="fas fa-box text-[18px] text-[#90caf9]" />
            <div>
              <div className="erp-page-title">Products</div>
              <div className="erp-page-description">Product Catalogue · Pricing · Inventory</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleDownloadBrochure}
              disabled={isBrochureDownloading}
              className="rounded-sm bg-[#2e7d32] px-3.5 py-1.5 text-[12px] font-bold text-white transition hover:bg-[#1b5e20] disabled:cursor-not-allowed disabled:opacity-70"
            >
              <i className="fas fa-file-pdf mr-1.5" />
              {isBrochureDownloading ? "Downloading..." : "Download Brochure"}
            </button>
            <button type="button" onClick={openCreateForm} className="erp-header-primary-button">
              <i className="fas fa-plus mr-1.5" />
              Add Product
            </button>
          </div>
        </div>

        <div className="erp-page-filters">
          <div className="erp-filter-label">
            <i className="fas fa-filter mr-1" />
            Filters
          </div>

          <div className="relative min-w-[200px] flex-1 md:max-w-[280px]">
            <i className="fas fa-search pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#90a4ae]" />
            <input
              value={searchInput}
              onChange={(event) => {
                setPage(1);
                setSearchInput(event.target.value);
              }}
              placeholder="Search products..."
              className="erp-input pl-7"
            />
          </div>

          <div className="relative min-w-[150px]">
            <i className="fas fa-tag pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#90a4ae]" />
            <select
              value={selectedCategory}
              onChange={(event) => {
                setPage(1);
                setSelectedCategory(event.target.value);
              }}
              className="erp-select pl-7"
            >
              <option value="">All Categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="relative min-w-[140px]">
            <i className="fas fa-signal pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#90a4ae]" />
            <select
              value={statusFilter}
              onChange={(event) => {
                setPage(1);
                setStatusFilter(event.target.value);
              }}
              className="erp-select pl-7"
            >
              <option value="">All Status</option>
              <option value="1">Active</option>
              <option value="0">Inactive</option>
            </select>
          </div>

          <button type="button" onClick={clearFilters} className="erp-filter-clear-button">
            <i className="fas fa-times mr-1" />
            Clear
          </button>
        </div>
      </section>

      <section className="table-card">
        {isError ? (
          <div className="px-4 py-10 text-[11px] text-[#c62828]">
            Failed to load products{error?.message ? `: ${error.message}` : "."}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className={`erp-table w-full table-fixed min-w-[780px] ${isLoading ? "opacity-70" : ""}`}>
                <thead>
                  <tr>
                    <th className="w-[8%] border-r border-[#4a7fa8]">ID</th>
                    <th className="w-[33%] border-r border-[#4a7fa8]">Product</th>
                    <th className="w-[18%] border-r border-[#4a7fa8]">Category</th>
                    <th className="w-[11%] border-r border-[#4a7fa8] text-center">Variants</th>
                    <th className="w-[10%] border-r border-[#4a7fa8] text-center">Status</th>
                    <th className="w-[12%] border-r border-[#4a7fa8]">Updated</th>
                    <th className="w-[8%] text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <TableSkeleton rows={8}>
                      {(index) => (
                        <tr key={`sk-${index}`}>
                          <td className="border-r border-[#d3dee7]">
                            <Skeleton className="mx-auto h-3 w-6" />
                          </td>
                          <td className="border-r border-[#d3dee7]">
                            <div className="flex items-center gap-2.5">
                              <Skeleton className="h-10 w-10 flex-shrink-0" />
                              <div className="min-w-0 space-y-1.5">
                                <Skeleton className="h-3 w-32" />
                                <Skeleton className="h-2.5 w-20 bg-[#e3ebf1]" />
                              </div>
                            </div>
                          </td>
                          <td className="border-r border-[#d3dee7]">
                            <Skeleton className="h-4 w-24" />
                          </td>
                          <td className="border-r border-[#d3dee7] text-center">
                            <Skeleton className="mx-auto h-4 w-10" />
                          </td>
                          <td className="border-r border-[#d3dee7] text-center">
                            <Skeleton className="mx-auto h-4 w-14" />
                          </td>
                          <td className="border-r border-[#d3dee7]">
                            <Skeleton className="h-4 w-20" />
                          </td>
                          <td className="text-center">
                            <Skeleton className="mx-auto h-8 w-8" />
                          </td>
                        </tr>
                      )}
                    </TableSkeleton>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-0 text-center text-[11px] italic text-[#90a4ae]">
                        <div className="flex min-h-[220px] items-center justify-center">
                          No products found for the current filters.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={row.id}>
                        <td className="border-r border-[#d3dee7] font-mono text-muted">{row.id}</td>
                        <td className="border-r border-[#d3dee7]">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={resolveProductImageUrl(row.fileUrl)}
                              alt={row.name}
                              className="h-10 w-10 flex-shrink-0 rounded-sm border border-[#b0bec5] object-cover"
                              onError={(event) => {
                                event.currentTarget.src = PRODUCT_PLACEHOLDER;
                              }}
                            />
                            <div className="min-w-0">
                              <p className="truncate text-[12px] font-bold text-ink">{row.name}</p>
                              <p className="mt-0.5 text-[10px] text-[#90a4ae]">Product</p>
                            </div>
                          </div>
                        </td>
                        <td className="border-r border-[#d3dee7]">
                          <span className="block truncate">{row.category?.name ?? "Uncategorized"}</span>
                        </td>
                        <td className="border-r border-[#d3dee7] text-center font-mono font-bold">{row.variantCount ?? 0}</td>
                        <td className="border-r border-[#d3dee7] text-center">
                          <span
                            className={`rounded-sm border px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                              row.status
                                ? "border-[#a5d6a7] bg-[#e8f5e9] text-[#2e7d32]"
                                : "border-[#b0bec5] bg-[#f3f6f9] text-muted"
                            }`}
                          >
                            {row.status ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="border-r border-[#d3dee7] text-muted">{formatDate(row.updatedAt)}</td>
                        <td className="text-center">
                          <button
                            type="button"
                            onClick={() => openEditForm(row)}
                            className="erp-icon-button-md"
                            title="Edit product"
                          >
                            <i className="fas fa-pen text-[11px]" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {!isLoading ? (
              <Pagination
                currentPage={meta?.currentPage ?? 1}
                lastPage={meta?.lastPage ?? 1}
                perPage={meta?.perPage ?? 10}
                total={meta?.total ?? 0}
                itemLabel="products"
                loading={isFetching}
                onPrevious={() => setPage((current) => Math.max(1, current - 1))}
                onNext={() =>
                  setPage((current) => (meta?.lastPage ? Math.min(meta.lastPage, current + 1) : current + 1))
                }
                onGoto={(targetPage) => setPage(targetPage)}
              />
            ) : null}
          </>
        )}
      </section>

      <FormModal
        show={showForm}
        title={isEditMode ? "Edit Product" : "Add Product"}
        size="4xl"
        onClose={() => void closeForm()}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <p className="text-[10px] text-[#546e7a]">
            {isEditMode
              ? "Update the product details and adjust variant pricing and reorder values."
              : "Create the product and one or more sellable variants in a single workflow."}
          </p>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label className="erp-label">Category</label>
              <select {...register("categoryId")} className="erp-select">
                <option value="">Select category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              {errors.categoryId ? <p className="mt-1 text-[10px] text-[#c62828]">{errors.categoryId.message}</p> : null}
              {categoriesLoading ? <p className="mt-2 text-[10px] text-muted">Loading category options...</p> : null}
            </div>

            <div>
              <label className="erp-label">Product Name</label>
              <input {...register("name")} className="erp-input" placeholder="e.g. PVC Pipe" />
              {errors.name ? <p className="mt-1 text-[10px] text-[#c62828]">{errors.name.message}</p> : null}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label className="erp-label">Product Status</label>
              <label className="inline-flex items-center gap-2 text-[11px] font-bold text-[#607d8b]">
                <input
                  type="checkbox"
                  {...register("status")}
                  className="sr-only"
                />
                <button
                  type="button"
                  onClick={() =>
                    setValue("status", !productStatus, {
                      shouldDirty: true,
                      shouldValidate: false
                    })
                  }
                  className={`relative inline-flex h-4 w-8 items-center rounded-full transition ${
                    productStatus ? "bg-[#2e7d32]" : "bg-[#b0bec5]"
                  }`}
                  aria-pressed={productStatus}
                  aria-label={`Set product as ${productStatus ? "inactive" : "active"}`}
                >
                  <span
                    className={`h-3 w-3 rounded-full bg-white shadow-sm transition ${
                      productStatus ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </button>
                <span>{productStatus ? "Active" : "Inactive"}</span>
              </label>
              <p className="mt-2 text-[10px] text-[#90a4ae]">
                Inactive products will stay in history but won&apos;t be available in active product lists.
              </p>
            </div>

            <div>
              <label className="erp-label">Product Type</label>
              <label className="flex items-center gap-2.5 rounded-sm border border-[#cfd8dc] bg-white p-2.5 transition hover:border-[#0070b8]">
                <input
                  type="checkbox"
                  {...register("hasVariants")}
                  className="h-4 w-4 rounded border-gray-300 text-[#0070b8] focus:ring-[#0070b8]"
                />
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-ink">This product has multiple variants</span>
                  <span className="text-[10px] text-[#546e7a]">e.g. different sizes, colors, or materials</span>
                </div>
              </label>
            </div>
          </div>

          <input type="hidden" {...register("fileUrl")} />

          <div>
            <label className="erp-label">Product Image</label>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />
            <div
              role="button"
              tabIndex={0}
              onClick={() => imageInputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  imageInputRef.current?.click();
                }
              }}
              className={`w-full border-2 border-dashed bg-[#f9fafc] transition-colors ${
                uploadImageMutation.isError ? "border-[#c62828] bg-[#fce4e4]/20" : "border-[#b0bec5] hover:border-[#0070b8]"
              }`}
            >
              <div className="flex min-h-[172px] items-center justify-center p-4">
                {!imagePreview ? (
                  <div className="text-center">
                    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#e8f1f8] text-[#0070b8]">
                      <i className="fas fa-image text-[20px]" />
                    </div>
                    <div className="text-[12px] font-bold text-[#546e7a]">Click to upload product image</div>
                    <div className="mt-1 text-[10px] text-[#90a4ae]">PNG, JPG, JPEG, GIF, WEBP · Max 10MB</div>
                  </div>
                ) : (
                  <div className="relative h-40 w-full overflow-hidden rounded-sm border border-[#b0bec5] bg-white">
                    <img
                      src={imagePreview}
                      alt="Product preview"
                      className="h-full w-full object-contain"
                      onError={(event) => {
                        event.currentTarget.src = PRODUCT_PLACEHOLDER;
                      }}
                    />
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void removeUploadedImage();
                      }}
                      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[#c62828] text-white"
                    >
                      <i className="fas fa-times text-[11px]" />
                    </button>
                    <div className="absolute inset-x-0 bottom-0 bg-black/45 px-2 py-1 text-center text-[10px] text-white">
                      Uploaded product image
                    </div>
                  </div>
                )}
              </div>
            </div>
            {uploadImageMutation.isPending ? <p className="mt-2 text-[10px] text-muted">Uploading image...</p> : null}
            {uploadImageMutation.isError ? (
              <p className="mt-2 text-[10px] text-[#c62828]">
                {uploadImageMutation.error?.response?.data?.message ?? "Failed to upload product image."}
              </p>
            ) : null}
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-[13px] font-bold text-ink">Variants</h3>
                <p className="text-[11px] text-muted">
                  {watch("hasVariants")
                    ? "Update variant name, cost, price, and reorder level. You can also add new child variants."
                    : "Enter the base pricing and stock info for this single-item product."}
                </p>
              </div>
              {watch("hasVariants") && (
                <button type="button" onClick={() => append({ ...defaultVariant })} className="erp-button-secondary">
                  Add Variant
                </button>
              )}
            </div>

            <div className="space-y-3">
              {fields.map((field, index) => {
                const variantStatus = watch(`variants.${index}.status`);

                return (
                <div key={field.fieldKey} className="rounded-sm border border-border bg-[#f9fafc] p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-[12px] font-bold text-ink">Variant #{index + 1}</p>
                      {field.id ? <p className="text-[10px] text-[#90a4ae]">Existing variant</p> : null}
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.5px] text-[#607d8b]">
                        <input
                          type="checkbox"
                          {...register(`variants.${index}.status`)}
                          className="sr-only"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setValue(`variants.${index}.status`, !variantStatus, {
                              shouldDirty: true,
                              shouldValidate: false
                            })
                          }
                          className={`relative inline-flex h-4 w-8 items-center rounded-full transition ${
                            variantStatus ? "bg-[#2e7d32]" : "bg-[#b0bec5]"
                          }`}
                          aria-pressed={variantStatus}
                          aria-label={`Set variant ${index + 1} as ${variantStatus ? "inactive" : "active"}`}
                        >
                          <span
                            className={`h-3 w-3 rounded-full bg-white shadow-sm transition ${
                              variantStatus ? "translate-x-4" : "translate-x-0.5"
                            }`}
                          />
                        </button>
                        <span>{variantStatus === false ? "Inactive" : "Active"}</span>
                      </label>

                      {fields.length > 1 ? (
                        <button type="button" onClick={() => handleVariantRemoveClick(index)} className="text-[11px] font-bold text-[#c62828]">
                          Remove
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {fields.length <= 1 ? (
                    <p className="mb-3 text-[10px] text-[#607d8b]">
                      Keep one variant. Mark inactive or delete the product instead.
                    </p>
                  ) : null}

                  <div className="grid gap-3 md:grid-cols-12">
                    <input type="hidden" {...register(`variants.${index}.id`)} />
                    
                    {watch("hasVariants") ? (
                      <div className="md:col-span-7">
                        <label className="erp-label">Variant Name</label>
                        <input 
                          {...register(`variants.${index}.name`)} 
                          className="erp-input" 
                          placeholder="e.g. XL, Red, or 500g" 
                        />
                        {errors.variants?.[index]?.name ? (
                          <p className="mt-1 text-[10px] text-[#c62828]">{errors.variants[index].name.message}</p>
                        ) : null}
                      </div>
                    ) : (
                      <div className="md:col-span-7">
                        <label className="erp-label">Product Pricing & Stock</label>
                        <p className="text-[11px] italic text-[#607d8b]">This is a single-variant product. Variant name is omitted.</p>
                      </div>
                    )}

                    <div className={watch("hasVariants") ? "md:col-span-5" : "md:col-span-5"}>
                      <label className="erp-label">Unit Cost</label>
                      <input type="number" step="0.01" {...register(`variants.${index}.unitCost`)} onFocus={(e) => e.target.select()} className="erp-input" />
                    </div>
                  </div>

                  <div className="mt-2 grid gap-3 md:grid-cols-3">
                    <div>
                      <label className="erp-label">Unit Price</label>
                      <input type="number" step="0.01" {...register(`variants.${index}.unitPrice`)} onFocus={(e) => e.target.select()} className="erp-input" />
                    </div>

                    <div>
                      <label className="erp-label">Reorder Level</label>
                      <input type="number" {...register(`variants.${index}.reorderLevel`)} onFocus={(e) => e.target.select()} className="erp-input" />
                    </div>

                    <div>
                      <label className="erp-label">Stock Quantity</label>
                      <input
                        type="number"
                        value={fields[index].stockQuantity ?? 0}
                        readOnly
                        className="erp-input cursor-not-allowed bg-[#eef2f5] text-[#90a4ae]"
                      />
                    </div>
                  </div>

                  <p className="mt-2 text-[10px] text-[#90a4ae]">Add stock in the Stock Adjustment page.</p>
                </div>
              );
              })}
            </div>

            {errors.variants?.message ? <p className="mt-2 text-[10px] text-[#c62828]">{errors.variants.message}</p> : null}
          </div>

          {createMutation.isError || updateMutation.isError || deleteVariantMutation.isError ? (
            <div className="rounded-sm border border-[#ef9a9a] bg-[#fff5f5] px-4 py-3 text-[11px] text-[#c62828]">
              Failed to {deleteVariantMutation.isError ? "remove variant" : isEditMode ? "update" : "create"} product
              {(deleteVariantMutation.error?.response?.data?.message ||
                updateMutation.error?.response?.data?.message ||
                createMutation.error?.response?.data?.message)
                ? `: ${
                    deleteVariantMutation.error?.response?.data?.message ??
                    updateMutation.error?.response?.data?.message ??
                    createMutation.error?.response?.data?.message
                  }`
                : "."}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => void closeForm()} className="erp-button-secondary">
              Cancel
            </button>
            <button type="submit" disabled={formBusy} className="erp-button-primary">
              {formBusy ? (isEditMode ? "Updating..." : "Saving...") : isEditMode ? "Update Product" : "Create Product"}
            </button>
          </div>
        </form>
      </FormModal>

      <ConfirmationModal
        show={Boolean(variantDeleteTarget)}
        title="Remove Variant"
        message={
          variantDeleteTarget
            ? `Are you sure you want to remove ${variantDeleteTarget.name}?`
            : ""
        }
        type="error"
        showCancel
        confirmText="Remove"
        cancelText="Cancel"
        onConfirm={() => void confirmVariantDelete()}
        onClose={() => setVariantDeleteTarget(null)}
      />
    </div>
  );
}
