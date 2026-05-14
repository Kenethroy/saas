import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { DateField } from "@/shared/components/common/DateField";
import { Pagination } from "@/shared/components/common/Pagination";
import { Skeleton } from "@/shared/components/common/Skeleton";
import { ConfirmationModal } from "@/shared/components/common/ConfirmationModal";
import { useNotification } from "@/shared/hooks/useNotification";
import { useCategoryOptions } from "@/modules/categories/hooks/useCategoryOptions";
import { createStockAdjustment, getInventoryOverview, submitStockAdjustment } from "@/modules/inventory/api/inventory.api";

function today() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toInt(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function normalizeIntegerInput(value) {
  if (value === "" || value === null || value === undefined) {
    return "";
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return "";
  }

  return String(Math.trunc(numericValue));
}

function clampInteger(value, min, max) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return min;
  }

  return Math.min(max, Math.max(min, Math.trunc(numericValue)));
}

function buildItemKey(variantId) {
  return String(variantId);
}

const REASON_OPTIONS = [
  { value: "", label: "Select reason" },
  { value: "damaged", label: "Damaged / Spoiled" },
  { value: "recount", label: "Physical Recount" },
  { value: "returned", label: "Customer Return" },
  { value: "lost", label: "Lost / Shrinkage" },
  { value: "initial", label: "Initial Stock Entry" },
  { value: "other", label: "Other" }
];

function shouldForceNonRestockable(reason) {
  return reason === "damaged" || reason === "lost";
}

function clampSignedInt(value, min, max) {
  const normalized = normalizeIntegerInput(value);
  if (normalized === "") return "";
  return String(clampInteger(normalized, min, max));
}

export function StockAdjustmentCreatePage() {
  const navigate = useNavigate();
  const notify = useNotification();
  const queryClient = useQueryClient();
  const [confirmModal, setConfirmModal] = useState(null);

  const [adjustmentDate, setAdjustmentDate] = useState(today());
  const [reason, setReason] = useState("");
  const [remarks, setRemarks] = useState("");
  const [items, setItems] = useState([]);

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const deferredSearch = useDeferredValue(searchInput.trim().toLowerCase());
  const [selectedCategoryId, setSelectedCategoryId] = useState("");

  const forceNonRestockable = shouldForceNonRestockable(reason);

  useEffect(() => {
    if (!forceNonRestockable) return;
    setItems((prev) => prev.map((item) => ({ ...item, restockFlag: false })));
  }, [forceNonRestockable]);

  const { data: categoriesResponse, isLoading: isCategoriesLoading } = useCategoryOptions();
  const categories = categoriesResponse?.data ?? [];

  const {
    data: inventoryResponse,
    isLoading: isInventoryLoading,
    isError: isInventoryError,
    error: inventoryError,
    isFetching: isInventoryFetching
  } = useQuery({
    queryKey: ["inventory-overview-stock-adjustment-create", page, deferredSearch, selectedCategoryId],
    queryFn: () =>
      getInventoryOverview({
        page,
        perPage: 10,
        ...(deferredSearch ? { search: deferredSearch } : {}),
        ...(selectedCategoryId ? { categoryId: Number(selectedCategoryId) } : {})
      })
  });

  const inventoryRows = inventoryResponse?.data ?? [];
  const inventoryMeta = inventoryResponse?.meta ?? {};
  const inventoryTotal = Number(inventoryMeta.total ?? 0);
  const inventoryCurrentPage = Number(inventoryMeta.currentPage ?? page);
  const inventoryLastPage = Number(inventoryMeta.lastPage ?? 1);

  const itemByVariantId = useMemo(() => {
    const map = new Map();
    for (const item of items) {
      map.set(buildItemKey(item.productVariantId), item);
    }
    return map;
  }, [items]);

  const createMutation = useMutation({
    mutationFn: (payload) => createStockAdjustment(payload),
    onError: (mutationError) => {
      notify.error(mutationError?.response?.data?.message ?? "Failed to create stock adjustment.");
    }
  });

  const submitMutation = useMutation({
    mutationFn: (id) => submitStockAdjustment(id),
    onError: (mutationError) => {
      notify.error(mutationError?.response?.data?.message ?? "Failed to submit stock adjustment.");
    }
  });

  function addVariantToItems(row) {
    const key = buildItemKey(row.id);
    if (itemByVariantId.has(key)) return;

    setItems((prev) => [
      ...prev,
      {
        productVariantId: row.id,
        label: row.label,
        onHand: row.onHand,
        categoryName: row.categoryName ?? "",
        stockStatus: row.stockStatus ?? null,
        restockFlag: !forceNonRestockable,
        quantityChange: "",
        notes: ""
      }
    ]);
  }

  function updateItem(variantId, patch) {
    const key = buildItemKey(variantId);
    setItems((prev) =>
      prev.map((item) => {
        if (buildItemKey(item.productVariantId) !== key) return item;
        const nextItem = { ...item, ...patch };
        const onHand = Number(nextItem.onHand ?? 0);
        const changeValue = nextItem.quantityChange === "" ? 0 : Number(nextItem.quantityChange ?? 0);
        if (!nextItem.restockFlag && Number.isFinite(changeValue) && changeValue > onHand) {
          return { ...nextItem, quantityChange: String(onHand) };
        }
        return nextItem;
      })
    );
  }

  function updateItemChange(variantId, nextValue) {
    const key = buildItemKey(variantId);
    setItems((prev) =>
      prev.map((item) => {
        if (buildItemKey(item.productVariantId) !== key) return item;

        const onHand = Number(item.onHand ?? 0);
        const min = item.restockFlag ? 0 : 0;
        const max = item.restockFlag ? 999999 : onHand;
        const clampedValue = clampSignedInt(nextValue, min, max);
        return { ...item, quantityChange: clampedValue };
      })
    );
  }

  function removeItem(variantId) {
    const key = buildItemKey(variantId);
    setItems((prev) => prev.filter((item) => buildItemKey(item.productVariantId) !== key));
  }

  function buildPayload() {
    const normalizedItems = items
      .map((item) => {
        const quantityInput = toInt(item.quantityChange);
        const restockFlag = forceNonRestockable ? false : Boolean(item.restockFlag);
        const quantityChange =
          Number.isFinite(quantityInput) && quantityInput !== 0 ? (restockFlag ? Math.abs(quantityInput) : -Math.abs(quantityInput)) : quantityInput;
        return {
          productVariantId: Number(item.productVariantId),
          quantityChange,
          restockFlag,
          notes: item.notes?.trim() ? item.notes.trim() : undefined
        };
      })
      .filter((item) => Number.isFinite(item.quantityChange) && item.quantityChange !== 0);

    return {
      adjustmentDate,
      reason: reason.trim() ? reason.trim() : undefined,
      remarks: remarks.trim() ? remarks.trim() : undefined,
      items: normalizedItems
    };
  }

  function validatePayload(payload) {
    if (!payload.items?.length) {
      notify.warning("Add at least one item with a non-zero quantity change.");
      return false;
    }

    return true;
  }

  function buildStockReductionConfirmModal(itemsToReduce, onConfirm) {
    return {
      type: "warning",
      title: "Confirm Stock Reduction",
      confirmText: "Proceed",
      message: (
        <div>
          <p className="text-[12px] leading-relaxed text-[#212121]">Some items will reduce stock. Continue?</p>
          <ul className="mt-2 max-h-40 list-disc space-y-1 overflow-y-auto pl-5 text-[11px] text-[#546e7a]">
            {itemsToReduce.map((item) => (
              <li key={item.productVariantId}>
                <span className="font-semibold text-[#1a3557]">{item.label ?? `Variant #${item.productVariantId}`}</span>{" "}
                <span className="font-mono">-{Math.abs(Number(item.quantityChange ?? 0))}</span>
              </li>
            ))}
          </ul>
        </div>
      ),
      onConfirm
    };
  }

  async function proceedSaveDraft(payload) {
    await createMutation.mutateAsync(payload);
    notify.success("Stock adjustment draft created.");
    await queryClient.invalidateQueries({ queryKey: ["stock-adjustments"] });
    navigate("/stock-adjustments");
  }

  async function proceedSubmit(payload) {
    const response = await createMutation.mutateAsync(payload);
    await submitMutation.mutateAsync(response.data.id);
    notify.success("Stock adjustment submitted.");
    await queryClient.invalidateQueries({ queryKey: ["stock-adjustments"] });
    navigate("/stock-adjustments");
  }

  async function saveDraft() {
    const payload = buildPayload();
    if (!validatePayload(payload)) return;

    const reductions = (payload.items ?? []).filter((item) => Number(item.quantityChange) < 0);
    if (reductions.length > 0) {
      setConfirmModal(buildStockReductionConfirmModal(reductions, () => void proceedSaveDraft(payload)));
      return;
    }

    await proceedSaveDraft(payload);
  }

  async function submitForApproval() {
    const payload = buildPayload();
    if (!validatePayload(payload)) return;

    const reductions = (payload.items ?? []).filter((item) => Number(item.quantityChange) < 0);
    if (reductions.length > 0) {
      setConfirmModal(buildStockReductionConfirmModal(reductions, () => void proceedSubmit(payload)));
      return;
    }

    await proceedSubmit(payload);
  }

  const busy = createMutation.isPending || submitMutation.isPending;

  return (
    <div className="space-y-4">
      <section className="erp-page-section erp-page-section-joined">
        <div className="erp-page-header">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => navigate("/stock-adjustments")} className="erp-back-button">
              <i className="fas fa-arrow-left text-[12px]" />
            </button>
            <div>
              <div className="erp-page-title">New Stock Adjustment</div>
              <div className="erp-page-description">Create a draft adjustment and submit it for approval.</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void saveDraft()} disabled={busy} className="erp-header-secondary-button disabled:cursor-not-allowed">
              <i className="fas fa-save mr-1.5" />
              {createMutation.isPending ? "Saving..." : "Save Draft"}
            </button>
            <button
              type="button"
              onClick={() => void submitForApproval()}
              disabled={busy}
              className="erp-header-primary-button disabled:cursor-not-allowed disabled:bg-[#89a9c1]"
            >
              <i className={`fas mr-1.5 ${submitMutation.isPending ? "fa-spinner fa-spin" : "fa-paper-plane"}`} />
              {submitMutation.isPending ? "Submitting..." : "Submit"}
            </button>
          </div>
        </div>
      </section>

      <section className="erp-page-main-card erp-page-main-card-joined p-3.5">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <DateField
              label="Adjustment Date"
              name="adjustmentDate"
              value={adjustmentDate}
              onChange={setAdjustmentDate}
              disabled={busy}
            />
          </div>
          <div>
            <label className="erp-label">Reason</label>
            <select className="erp-select" value={reason} onChange={(e) => setReason(e.target.value)} disabled={busy}>
              {REASON_OPTIONS.map((option) => (
                <option key={option.value || "blank"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div />
        </div>

        <div className="mt-4">
          <label className="erp-label">Remarks</label>
          <textarea className="erp-textarea h-24" value={remarks} onChange={(e) => setRemarks(e.target.value)} disabled={busy} />
        </div>

        {forceNonRestockable ? (
          <div className="mt-4 rounded-md border border-[#ffe082] bg-[#fff8e1] px-4 py-3 text-[12px] text-[#7a4b00]">
            Reason <span className="font-semibold">{reason}</span> forces all items to be non-restockable.
          </div>
        ) : null}
      </section>

      <section className="grid gap-2 xl:grid-cols-2">
        <div className="app-shell-card">
          <div className="border-b border-[#e3ebf1] px-4 py-3">
            <div className="flex flex-col gap-2">
              <div className="overflow-x-auto">
                <div className="flex min-w-max gap-2 pb-1">
                  <button
                    type="button"
                    onClick={() => {
                      setPage(1);
                      setSelectedCategoryId("");
                    }}
                    disabled={busy || isCategoriesLoading}
                    className={`rounded-sm border px-3 py-1.5 text-[11px] font-bold transition ${
                      selectedCategoryId === ""
                        ? "border-[#0070b8] bg-[#0070b8] text-white"
                        : "border-[#c8d6e2] bg-[#f8fbfd] text-[#546e7a] hover:border-[#9eb9d0] hover:bg-white"
                    } ${busy ? "cursor-not-allowed opacity-70" : ""}`}
                  >
                    All
                  </button>

                  {isCategoriesLoading
                    ? Array.from({ length: 5 }).map((_, index) => <Skeleton key={`cat-tab-sk-${index}`} className="h-8 w-24 rounded-sm" />)
                    : categories.map((category) => {
                        const isActive = String(selectedCategoryId) === String(category.id);
                        return (
                          <button
                            key={category.id}
                            type="button"
                            onClick={() => {
                              setPage(1);
                              setSelectedCategoryId(String(category.id));
                            }}
                            disabled={busy}
                            className={`whitespace-nowrap rounded-sm border px-3 py-1.5 text-[11px] font-bold transition ${
                              isActive
                                ? "border-[#0070b8] bg-[#0070b8] text-white"
                                : "border-[#c8d6e2] bg-[#f8fbfd] text-[#546e7a] hover:border-[#9eb9d0] hover:bg-white"
                            } ${busy ? "cursor-not-allowed opacity-70" : ""}`}
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
                  value={searchInput}
                  onChange={(event) => {
                    setPage(1);
                    setSearchInput(event.target.value);
                  }}
                  placeholder="Search variants..."
                  className="erp-input pl-7 pr-20"
                  disabled={busy}
                />
                {searchInput ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPage(1);
                      setSearchInput("");
                    }}
                    className="absolute right-5 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-sm text-[11px] text-[#78909c] transition hover:bg-[#eef5fa] hover:text-[#1a3557]"
                    aria-label="Clear variant search"
                    title="Clear search"
                    disabled={busy}
                  >
                    <i className="fas fa-times" aria-hidden="true" />
                  </button>
                ) : null}
                {isInventoryFetching ? (
                  <span
                    className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-[10px] font-semibold text-[#90a4ae] ${
                      searchInput ? "right-12" : "right-2"
                    }`}
                  >
                    Searching...
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {isInventoryError ? (
            <div className="px-4 py-10 text-[11px] text-[#c62828]">
              Failed to load inventory{inventoryError?.message ? `: ${inventoryError.message}` : "."}
            </div>
          ) : (
            <>
              <div className="p-4">
                <div className="max-h-[700px] overflow-y-auto pr-1">
                  {isInventoryLoading ? (
                    <div className="grid grid-cols-2 gap-2.5">
                      {Array.from({ length: 6 }).map((_, index) => (
                        <div key={`inv-skel-${index}`} className="rounded-sm border border-[#d3dee7] bg-[#f8fbfd] p-2.5">
                          <Skeleton className="h-3 w-44" />
                          <Skeleton className="mt-2 h-2.5 w-28 bg-[#e3ebf1]" />
                          <Skeleton className="mt-2 h-2.5 w-20 bg-[#e3ebf1]" />
                          <Skeleton className="mt-3 h-7 w-20" />
                        </div>
                      ))}
                    </div>
                  ) : inventoryRows.length === 0 ? (
                    <div className="flex min-h-[280px] items-center justify-center text-[11px] italic text-[#90a4ae]">
                      No inventory variants found for the current filters.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      {inventoryRows.map((row) => {
                        const key = buildItemKey(row.id);
                        const alreadyAdded = itemByVariantId.has(key);

                        return (
                          <article
                            key={row.id}
                            className={`rounded-sm border p-2.5 transition ${
                              alreadyAdded
                                ? "border-[#0070b8] bg-[#e8f1f8]"
                                : "border-[#d3dee7] bg-[#f8fbfd] hover:border-[#9eb9d0] hover:bg-white"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[11px] font-bold text-[#1a3557]" title={row.label}>
                                  {row.label ?? `Variant #${row.id}`}
                                </p>
                                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-[#90a4ae]">
                                  <span>
                                    On hand <span className="font-mono text-[#607d8b]">{Number(row.onHand ?? 0)}</span>
                                  </span>
                                  <span className="text-[#c8d6e2]">•</span>
                                  <span>{row.categoryName ?? "—"}</span>
                                </div>
                                <div className="mt-1 text-[10px] font-semibold text-[#607d8b]">{row.stockStatus ?? "—"}</div>
                              </div>

                              <button
                                type="button"
                                className="erp-button-secondary shrink-0"
                                onClick={() => addVariantToItems(row)}
                                disabled={alreadyAdded || busy || isInventoryFetching}
                                title={alreadyAdded ? "Already added" : "Add item"}
                              >
                                {alreadyAdded ? "Added" : "Add"}
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t bg-white px-4 py-3">
                <Pagination
                  currentPage={inventoryCurrentPage}
                  lastPage={inventoryLastPage}
                  perPage={10}
                  total={inventoryTotal}
                  itemLabel="variants"
                  loading={isInventoryFetching}
                  onPrevious={() => setPage(Math.max(1, inventoryCurrentPage - 1))}
                  onNext={() => setPage(Math.min(inventoryLastPage, inventoryCurrentPage + 1))}
                  onGoto={(nextPage) => setPage(nextPage)}
                />
              </div>
            </>
          )}
        </div>

        <aside className="app-shell-card">
          <section className="border-b border-[#e3ebf1] p-3">
            <div className="flex items-center gap-2 pb-2">
              <i className="fas fa-list-check text-[13px] text-[#0070b8]" />
              <p className="text-[13px] font-bold text-[#1a3557]">Items</p>
            </div>

            {items.length === 0 ? (
              <div className="flex min-h-[220px] items-center justify-center text-[11px] italic text-[#90a4ae]">
                Add variants from the left panel to start this adjustment.
              </div>
            ) : (
              <div className="mt-2 max-h-[560px] space-y-2 overflow-y-auto pr-1">
                {items.map((item) => {
                  const onHand = Number(item.onHand ?? 0);
                  const changeRaw = item.quantityChange;
                  const changeValue = changeRaw === "" ? 0 : Number(changeRaw ?? 0);
                  const restockable = Boolean(item.restockFlag) && !forceNonRestockable;

                  return (
                    <article key={item.productVariantId} className="rounded-sm border border-[#d3dee7] bg-[#f8fbfd] px-2.5 py-2">
                      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[11px] font-bold text-[#1a3557]" title={item.label}>
                            {item.label ?? `Variant #${item.productVariantId}`}
                          </p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[9px] text-[#90a4ae]">
                            <span>On hand {Number.isFinite(onHand) ? onHand : "-"}</span>
                            {item.categoryName ? <span>Category {item.categoryName}</span> : null}
                            {forceNonRestockable ? <span className="font-bold text-[#8d6e00]">Forced non-restockable</span> : null}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <div className="flex flex-col gap-[3px]">
                            <span className="text-[9px] font-bold uppercase tracking-[0.3px] text-[#90a4ae]">Restock</span>
                            <input
                              type="checkbox"
                              checked={restockable}
                              disabled={busy || forceNonRestockable}
                              onChange={(e) => updateItem(item.productVariantId, { restockFlag: e.target.checked })}
                              title={forceNonRestockable ? "Disabled for this reason" : "Checked = add stock, unchecked = deduct stock"}
                            />
                          </div>

                          <div className="flex flex-col gap-[3px]">
                            <span className="text-[9px] font-bold uppercase tracking-[0.3px] text-[#90a4ae]">Change</span>
                            <div className="flex items-center overflow-hidden rounded-sm border border-[#d3dee7] bg-white">
                              <button
                                type="button"
                                onClick={() => updateItemChange(item.productVariantId, String(changeValue - 1))}
                                className="inline-flex h-[26px] w-[26px] items-center justify-center border-r border-[#d3dee7] bg-[#f3f6f9] text-[10px] text-[#546e7a] transition hover:bg-[#e8f1f8] hover:text-[#0070b8] disabled:cursor-not-allowed disabled:bg-[#f9fafc] disabled:text-[#b0bec5]"
                                disabled={busy}
                                title="Decrease"
                              >
                                <i className="fas fa-minus" />
                              </button>
                              <input
                                value={changeRaw}
                                onChange={(e) => updateItemChange(item.productVariantId, e.target.value)}
                                className="h-[26px] w-[74px] border-none px-2 text-right font-mono text-[11px] text-[#1a3557] outline-none"
                                placeholder="0"
                                disabled={busy}
                              />
                              <button
                                type="button"
                                onClick={() => updateItemChange(item.productVariantId, String(changeValue + 1))}
                                className="inline-flex h-[26px] w-[26px] items-center justify-center border-l border-[#d3dee7] bg-[#f3f6f9] text-[10px] text-[#546e7a] transition hover:bg-[#e8f1f8] hover:text-[#0070b8] disabled:cursor-not-allowed disabled:bg-[#f9fafc] disabled:text-[#b0bec5]"
                                disabled={busy}
                                title="Increase"
                              >
                                <i className="fas fa-plus" />
                              </button>
                            </div>
                          </div>

                          <button
                            type="button"
                            className="erp-btn-link text-[#c62828] hover:text-[#b71c1c]"
                            onClick={() => removeItem(item.productVariantId)}
                            disabled={busy}
                            title="Remove"
                          >
                            <i className="fas fa-trash-alt text-[14px]" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-2">
                        <input
                          className="erp-input"
                          value={item.notes}
                          onChange={(e) => updateItem(item.productVariantId, { notes: e.target.value })}
                          placeholder="Notes (optional)"
                          disabled={busy}
                        />
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </aside>
      </section>

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
