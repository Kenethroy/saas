import { useDeferredValue, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ConfirmationModal } from "@/shared/components/common/ConfirmationModal";
import { FormModal } from "@/shared/components/common/FormModal";
import { Pagination } from "@/shared/components/common/Pagination";
import { Skeleton } from "@/shared/components/common/Skeleton";
import { useNotification } from "@/shared/hooks/useNotification";
import { createCategory, deleteCategory, updateCategory } from "@/modules/categories/api/categories.api";
import { useCategories } from "@/modules/categories/hooks/useCategories";

const categoryFormSchema = z.object({
  name: z.string().trim().min(1, "Category name is required").max(255, "Category name is too long"),
  description: z.string().trim().max(2000, "Description is too long").optional()
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

function CategoryCardSkeleton() {
  return (
    <article className="erp-entity-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-5 w-14" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="erp-entity-card-panel">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-2 h-5 w-10" />
        </div>
        <div className="erp-entity-card-panel">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-2 h-5 w-10" />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-[#e3ebf1] pt-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-8" />
      </div>
    </article>
  );
}

function StatusBadge({ active }) {
  return (
    <span
      className={`erp-status-badge ${
        active
          ? "border-[#c2ddbe] bg-[#f3faf1] text-[#356b37]"
          : "border-[#c8d3db] bg-[#f8fafb] text-[#5f7283]"
      }`}
    >
      <span className="erp-status-badge-dot" />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export function CategoriesPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const deferredSearch = useDeferredValue(searchInput.trim());
  const queryClient = useQueryClient();
  const notify = useNotification();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: "",
      description: ""
    }
  });

  const { data, isLoading, isError, error, isFetching } = useCategories({
    page,
    perPage: 12,
    ...(deferredSearch ? { search: deferredSearch } : {}),
    ...(statusFilter !== "" ? { status: statusFilter === "1" } : {})
  });

  const createMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
      await queryClient.invalidateQueries({ queryKey: ["category-options"] });
      notify.success("Category created successfully");
      reset();
      setShowForm(false);
      setEditingCategory(null);
      setPage(1);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ categoryId, payload }) => updateCategory(categoryId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
      await queryClient.invalidateQueries({ queryKey: ["category-options"] });
      notify.success("Category updated successfully");
      reset();
      setShowForm(false);
      setEditingCategory(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
      await queryClient.invalidateQueries({ queryKey: ["category-options"] });
      notify.success("Category deleted successfully");
      setDeleteTarget(null);
    },
    onError: (mutationError) => {
      notify.warning(
        mutationError?.response?.data?.message ?? "Category cannot be deleted right now."
      );
    }
  });

  const categories = data?.data ?? [];
  const meta = data?.meta;

  function clearFilters() {
    setPage(1);
    setSearchInput("");
    setStatusFilter("");
  }

  function closeForm() {
    reset();
    setShowForm(false);
    setEditingCategory(null);
  }

  function openCreateForm() {
    reset({
      name: "",
      description: ""
    });
    setEditingCategory(null);
    setShowForm(true);
  }

  function openEditForm(category) {
    reset({
      name: category.name ?? "",
      description: category.description ?? ""
    });
    setEditingCategory(category);
    setShowForm(true);
  }

  async function onSubmit(values) {
    const payload = {
      name: values.name,
      description: values.description?.trim() || null
    };

    if (editingCategory) {
      await updateMutation.mutateAsync({
        categoryId: editingCategory.id,
        payload
      });
      return;
    }

    await createMutation.mutateAsync(payload);
  }

  async function confirmDeleteCategory() {
    if (!deleteTarget) {
      return;
    }

    await deleteMutation.mutateAsync(deleteTarget.id);
  }

  const formBusy = isSubmitting || createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4">
      <section className="erp-page-section">
        <div className="erp-page-header">
          <div className="flex items-center gap-3">
            <i className="fas fa-tags text-[18px] text-[#90caf9]" />
            <div>
              <div className="erp-page-title">Categories</div>
              <div className="erp-page-description">Product grouping and catalogue organization</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openCreateForm}
              className="erp-header-primary-button"
            >
              <i className="fas fa-plus mr-1.5" />
              Add Category
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
              placeholder="Search categories..."
              className="erp-input pl-7"
            />
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

      {isError ? (
        <section className="rounded-sm border border-[#ef9a9a] bg-[#fff5f5] px-4 py-8 text-[11px] text-[#c62828]">
          Failed to load categories{error?.message ? `: ${error.message}` : "."}
        </section>
      ) : (
        <section className="space-y-4">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <CategoryCardSkeleton key={index} />
              ))}
            </div>
          ) : categories.length === 0 ? (
            <section className="app-shell-card px-4 py-0">
              <div className="flex min-h-[220px] items-center justify-center text-[11px] italic text-[#90a4ae]">
                No categories found for the current filters.
              </div>
            </section>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                {categories.map((category) => (
                  <article
                    key={category.id}
                    className="erp-entity-card"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate text-[13px] font-bold text-[#1a3557]">{category.name}</h2>
                        <p className="mt-1 text-[10px] text-[#607d8b]">Category #{category.id}</p>
                      </div>
                      <StatusBadge active={category.status} />
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="erp-entity-card-panel">
                        <p className="text-[10px] font-bold uppercase tracking-[0.5px] text-[#607d8b]">Products</p>
                        <p className="mt-1 text-[20px] font-bold text-[#1a3557]">{category.productCount ?? 0}</p>
                      </div>
                      <div className="erp-entity-card-panel">
                        <p className="text-[10px] font-bold uppercase tracking-[0.5px] text-[#607d8b]">Active Variants</p>
                        <p className="mt-1 text-[20px] font-bold text-[#1a3557]">{category.variantCount ?? 0}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-[#e3ebf1] pt-3">
                      <div className="text-[10px] text-[#90a4ae]">
                        Updated <span className="font-bold text-[#607d8b]">{formatDate(category.updatedAt)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditForm(category)}
                          className="erp-icon-button-md"
                          title="Edit category"
                        >
                          <i className="fas fa-pen text-[11px]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(category)}
                          className="erp-icon-button-danger-md"
                          title="Delete category"
                        >
                          <i className="fas fa-trash text-[11px]" />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <section className="table-card">
                <Pagination
                  currentPage={meta?.currentPage ?? 1}
                  lastPage={meta?.lastPage ?? 1}
                  perPage={meta?.perPage ?? 12}
                  total={meta?.total ?? 0}
                  itemLabel="categories"
                  loading={isFetching}
                  onPrevious={() => setPage((current) => Math.max(1, current - 1))}
                  onNext={() =>
                    setPage((current) => (meta?.lastPage ? Math.min(meta.lastPage, current + 1) : current + 1))
                  }
                  onGoto={(targetPage) => setPage(targetPage)}
                />
              </section>
            </>
          )}
        </section>
      )}

      <FormModal show={showForm} title={editingCategory ? "Edit Category" : "Add Category"} size="lg" onClose={closeForm}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <p className="text-[10px] text-[#546e7a]">
            {editingCategory
              ? "Update the category details used to group related products."
              : "Create a category for grouping related products in the catalogue."}
          </p>

          <div>
            <label className="erp-label">Category Name</label>
            <input
              {...register("name")}
              className="erp-input"
              placeholder="e.g. Pipes and Plumbing"
            />
            {errors.name ? <p className="mt-1 text-[10px] text-[#c62828]">{errors.name.message}</p> : null}
          </div>

          <div>
            <label className="erp-label">Description</label>
            <textarea
              {...register("description")}
              rows={4}
              className="erp-input min-h-[96px] resize-none"
              placeholder="Optional notes about this category."
            />
            {errors.description ? (
              <p className="mt-1 text-[10px] text-[#c62828]">{errors.description.message}</p>
            ) : null}
          </div>

          {createMutation.isError || updateMutation.isError ? (
            <div className="rounded-sm border border-[#ef9a9a] bg-[#fff5f5] px-4 py-3 text-[11px] text-[#c62828]">
              Failed to {editingCategory ? "update" : "create"} category
              {(updateMutation.error?.response?.data?.message || createMutation.error?.response?.data?.message)
                ? `: ${updateMutation.error?.response?.data?.message ?? createMutation.error?.response?.data?.message}`
                : "."}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={closeForm} className="erp-button-secondary">
              Cancel
            </button>
            <button type="submit" disabled={formBusy} className="erp-button-primary">
              {formBusy ? "Saving..." : editingCategory ? "Update Category" : "Create Category"}
            </button>
          </div>
        </form>
      </FormModal>

      <ConfirmationModal
        show={Boolean(deleteTarget)}
        title="Delete Category"
        message={
          deleteTarget
            ? deleteTarget.productCount > 0
              ? `${deleteTarget.name} cannot be deleted because it still has linked products.`
              : `Are you sure you want to delete ${deleteTarget.name}?`
            : ""
        }
        type={deleteTarget?.productCount > 0 ? "warning" : "error"}
        showCancel={deleteTarget?.productCount <= 0}
        confirmText={deleteTarget?.productCount > 0 ? "OK" : "Delete"}
        cancelText="Cancel"
        onConfirm={() => {
          if (deleteTarget?.productCount > 0) {
            return;
          }

          void confirmDeleteCategory();
        }}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
