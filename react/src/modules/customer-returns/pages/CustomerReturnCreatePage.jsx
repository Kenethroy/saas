import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DateField } from "@/shared/components/common/DateField";
import SelectionModal from "@/shared/components/common/SelectionModal";
import { useNotification } from "@/shared/hooks/useNotification";
import {
  createCustomerReturn,
  getCustomerInvoices
} from "@/modules/customer-returns/api/customer-returns.api";
import { getCategories } from "@/modules/categories/api/categories.api";
import { getCustomers } from "@/modules/customers/api/customers.api";
import { getProducts, resolveProductImageUrl } from "@/modules/products/api/products.api";

const reasonOptions = [
  { value: "Damaged", label: "Damaged / Spoiled" },
  { value: "Defective", label: "Defective Product" },
  { value: "Wrong Item", label: "Wrong Item Delivered" },
  { value: "Over Shipment", label: "Over Shipment" },
  { value: "Quality Issue", label: "Quality Issue" },
  { value: "Customer Changed Mind", label: "Customer Changed Mind" }
];

const dispositionOptions = [
  { value: "Replacement", label: "Replacement" },
  { value: "Credit Memo", label: "Credit Memo" },
  { value: "Refund", label: "Refund" },
  { value: "Repair", label: "Repair" }
];

const nonRestockReasons = new Set(["Damaged", "Defective", "Quality Issue"]);

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

function normalizeErrorMessage(error, fallback) {
  return error?.response?.data?.message ?? error?.message ?? fallback;
}

function productSearchText(entry) {
  return [entry.name, entry.productName, entry.sku, entry.productSku]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getProductCardMeta(product, selectedInvoice) {
  if (selectedInvoice) {
    return {
      id: `${product.productId ?? product.id}-${product.productVariantId ?? "default"}`,
      productId: Number(product.productId ?? product.id),
      productVariantId: product.productVariantId ?? null,
      name: product.name || product.productName || "Product",
      variantName: product.variantName || "Default",
      categoryName: product.categoryName || "Invoice Item",
      subtitle: product.sku || product.productSku || "Linked sales invoice item",
      stockLabel: `Qty on invoice ${Number(product.maxQuantity ?? product.quantity ?? 0)}`,
      price: Number(product.unitPrice ?? product.price ?? 0),
      fileUrl: null
    };
  }

  const firstVariant = product.variants?.[0] ?? null;

  return {
    id: product.id,
    productId: Number(product.id),
    productVariantId: firstVariant?.id ?? null,
    name: product.name || "Product",
    variantName: firstVariant?.name || "Default",
    categoryName: product.category?.name || "Uncategorized",
    subtitle: firstVariant?.name || "Base variant",
    stockLabel: `Stock ${Number(firstVariant?.stockQuantity ?? 0)}`,
    price: Number(firstVariant?.unitPrice ?? 0),
    fileUrl: product.fileUrl || null
  };
}

export function CustomerReturnCreatePage() {
  const navigate = useNavigate();
  const notify = useNotification();
  const [isLoadingReferenceData, setIsLoadingReferenceData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [productSearchInput, setProductSearchInput] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [form, setForm] = useState({
    type: "customer",
    rmaNumber: "",
    customerId: "",
    invoiceId: "",
    requestDate: new Date().toISOString().slice(0, 10),
    reason: "",
    disposition: "Replacement",
    items: [],
    notes: ""
  });

  useEffect(() => {
    let cancelled = false;

    async function loadReferenceData() {
      setIsLoadingReferenceData(true);

      try {
        const [customersResponse, productsResponse, categoriesResponse] = await Promise.all([
          getCustomers({ page: 1, perPage: 100, status: true }),
          getProducts({ page: 1, perPage: 100, status: true }),
          getCategories({ status: true })
        ]);

        if (cancelled) {
          return;
        }

        setCustomers(customersResponse?.data ?? []);
        setProducts(productsResponse?.data ?? []);
        setCategories(categoriesResponse?.data ?? []);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(normalizeErrorMessage(error, "Failed to load reference data."));
        }
      } finally {
        if (!cancelled) {
          setIsLoadingReferenceData(false);
        }
      }
    }

    loadReferenceData();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const shouldRestockByDefault = !nonRestockReasons.has(form.reason);

    setForm((current) => ({
      ...current,
      items: current.items.map((item) => ({
        ...item,
        restockFlag: shouldRestockByDefault
      }))
    }));
  }, [form.reason]);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = productSearchInput.trim().toLowerCase();
    const source = selectedInvoice ? invoiceItems : products;

    return source.filter((entry) => {
      const matchesSearch = !normalizedSearch || productSearchText(entry).includes(normalizedSearch);
      const matchesCategory =
        selectedInvoice ||
        !selectedCategory ||
        String(entry.categoryId ?? entry.category?.id ?? "") === String(selectedCategory);

      return matchesSearch && matchesCategory;
    });
  }, [invoiceItems, productSearchInput, products, selectedCategory, selectedInvoice]);

  const totalAmount = useMemo(
    () => form.items.reduce((sum, item) => sum + Number(item.quantity ?? 0) * Number(item.unitPrice ?? 0), 0),
    [form.items]
  );

  const isFormValid =
    Boolean(form.customerId) &&
    Boolean(form.invoiceId) &&
    Boolean(form.requestDate) &&
    Boolean(form.reason) &&
    form.items.length > 0;

  function getItemKey(item) {
    return Number(item?.productVariantId ?? item?.productId);
  }

  function isAdded(itemKey) {
    return form.items.some((item) => getItemKey(item) === Number(itemKey));
  }

  async function handleSelectCustomer(customer) {
    setShowCustomerModal(false);
    setSelectedCustomer(customer);
    setSelectedInvoice(null);
    setInvoices([]);
    setInvoiceItems([]);
    setErrorMessage("");
    setProductSearchInput("");
    setSelectedCategory("");
    setForm((current) => ({
      ...current,
      customerId: customer.id,
      invoiceId: "",
      items: []
    }));

    try {
      const invoicesResponse = await getCustomerInvoices(customer.id);
      setInvoices(invoicesResponse?.data ?? []);
    } catch (error) {
      notify.error(normalizeErrorMessage(error, "Failed to load customer invoices."));
    }
  }

  function handleSelectInvoice(invoice) {
    setShowInvoiceModal(false);
    setSelectedInvoice(invoice);
    setProductSearchInput("");
    setErrorMessage("");
    setForm((current) => ({
      ...current,
      invoiceId: invoice.id,
      items: []
    }));

    if (!Array.isArray(invoice.items) || invoice.items.length === 0) {
      setInvoiceItems([]);
      notify.warning("No invoice items were found for this sales invoice.");
      return;
    }

    setInvoiceItems(
      invoice.items.map((item) => ({
        id: item.productId,
        productId: item.productId,
        productVariantId: item.productVariantId,
        productName: item.productName || "Product",
        name: item.productName || "Product",
        productSku: item.productSku || "",
        sku: item.productSku || "",
        quantity: Number(item.quantity ?? 0),
        maxQuantity: Number(item.quantity ?? 0),
        unitPrice: Number(item.unitPrice ?? 0),
        price: Number(item.unitPrice ?? 0),
        variantName: item.variantName || "Default"
      }))
    );
  }

  function addItem(product) {
    const productVariantId = product.productVariantId ?? product.variants?.[0]?.id ?? null;
    if (!productVariantId) {
      notify.warning("This product does not have an available variant to return.");
      return;
    }

    if (isAdded(productVariantId)) {
      return;
    }

    const productId = Number(product.productId ?? product.id);

    const unitPrice = Number(product.unitPrice ?? product.price ?? product.variants?.[0]?.unitPrice ?? 0);
    const maxQuantity = Math.max(
      1,
      Number(product.maxQuantity ?? product.quantity ?? product.variants?.[0]?.stockQuantity ?? 1)
    );
    const shouldRestockByDefault = !nonRestockReasons.has(form.reason);

    setForm((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          productId,
          productVariantId,
          name: product.name || product.productName || "Product",
          variantName: product.variantName || product.variants?.[0]?.name || "Default",
          quantity: 1,
          maxQuantity,
          unitPrice,
          originalPrice: unitPrice,
          lineTotal: unitPrice,
          restockFlag: shouldRestockByDefault
        }
      ]
    }));
  }

  function removeItem(itemKey) {
    setForm((current) => ({
      ...current,
      items: current.items.filter((item) => getItemKey(item) !== Number(itemKey))
    }));
  }

  function updateItemQty(itemKey, nextQuantity) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (getItemKey(item) !== Number(itemKey)) {
          return item;
        }

        const normalizedQuantity = Math.max(1, Math.min(Number(nextQuantity) || 1, Number(item.maxQuantity ?? 1)));

        return {
          ...item,
          quantity: normalizedQuantity,
          lineTotal: normalizedQuantity * Number(item.unitPrice ?? 0)
        };
      })
    }));
  }

  function updateItemPrice(itemKey, nextPrice) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (getItemKey(item) !== Number(itemKey)) {
          return item;
        }

        const normalizedPrice = Math.max(0, Number(nextPrice) || 0);

        return {
          ...item,
          unitPrice: normalizedPrice,
          lineTotal: Number(item.quantity ?? 0) * normalizedPrice
        };
      })
    }));
  }

  function toggleRestock(itemKey) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) =>
        getItemKey(item) === Number(itemKey)
          ? {
              ...item,
              restockFlag: !item.restockFlag
            }
          : item
      )
    }));
  }

  async function handleSubmit(status) {
    if (!isFormValid) {
      notify.warning("Complete the required return details and add at least one item.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await createCustomerReturn({
        ...form,
        status,
        totalAmount,
        customerId: Number(form.customerId),
        invoiceId: form.invoiceId ? Number(form.invoiceId) : null,
        items: form.items.map((item) => ({
          productId: Number(item.productId),
          productVariantId: Number(item.productVariantId),
          productName: item.name,
          variantName: item.variantName || "Default",
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          lineTotal: Number(item.quantity) * Number(item.unitPrice),
          restockFlag: Boolean(item.restockFlag)
        }))
      });

      notify.success(status === "draft" ? "Customer return saved as draft." : "Customer return submitted successfully.");
      navigate("/admin/customer-returns");
    } catch (error) {
      const message = normalizeErrorMessage(error, "Failed to process return request.");
      setErrorMessage(message);
      notify.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <section className="erp-page-section">
        <div className="erp-page-header">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/admin/customer-returns")}
              className="erp-back-button"
              title="Back to Customer Returns"
            >
              <i className="fas fa-arrow-left text-[12px]" />
            </button>
            <div>
              <div className="erp-page-title">Create Customer Return</div>
              <div className="erp-page-description">
                Select a customer invoice, add return items, and prepare the RMA for review.
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate("/admin/customer-returns")}
              className="erp-header-secondary-button"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleSubmit("draft")}
              disabled={isSubmitting || !isFormValid}
              className="erp-header-secondary-button"
            >
              <i className="fas fa-save mr-1.5" />
              {isSubmitting ? "Saving..." : "Save Draft"}
            </button>
            <button
              type="button"
              onClick={() => handleSubmit("pending")}
              disabled={isSubmitting || !isFormValid}
              className="erp-header-primary-button"
            >
              <i className="fas fa-paper-plane mr-1.5" />
              {isSubmitting ? "Submitting..." : "Submit Request"}
            </button>
          </div>
        </div>
      </section>

      {errorMessage ? (
        <section className="rounded-sm border border-[#ef9a9a] bg-[#fff5f5] px-4 py-3 text-[11px] text-[#c62828]">
          {errorMessage}
        </section>
      ) : null}

      <form id="customer-return-create-form" className="space-y-4 erp-form-stack" onSubmit={(event) => event.preventDefault()}>
        <section className="erp-page-main-card p-4">
          <div className="mb-4 flex items-center gap-2 border-b border-[#e3ebf1] pb-3">
            <i className="fas fa-clipboard-check text-[13px] text-[#0070b8]" />
            <p className="text-[13px] font-bold text-[#1a3557]">Return Details</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div>
              <label className="erp-label">Customer</label>
              <button
                type="button"
                onClick={() => setShowCustomerModal(true)}
                disabled={isLoadingReferenceData || isSubmitting}
                className="erp-date-picker-trigger h-9 px-3"
              >
                <span className={`truncate ${selectedCustomer ? "text-[#1d2730]" : "text-[#8aa0b2]"}`}>
                  {selectedCustomer?.name || (isLoadingReferenceData ? "Loading customers..." : "Select customer")}
                </span>
                <span className="erp-date-picker-icon">
                  <i className="fas fa-search text-[12px]" />
                </span>
              </button>
            </div>

            <div>
              <label className="erp-label">Sales Invoice</label>
              <button
                type="button"
                onClick={() => {
                  if (!selectedCustomer) {
                    notify.warning("Select a customer first.");
                    return;
                  }

                  setShowInvoiceModal(true);
                }}
                disabled={!selectedCustomer || isSubmitting}
                className="erp-date-picker-trigger h-9 px-3 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <span className={`truncate ${selectedInvoice ? "text-[#1d2730]" : "text-[#8aa0b2]"}`}>
                  {selectedInvoice?.invoiceNumber || (selectedCustomer ? "Select invoice" : "Select customer first")}
                </span>
                <span className="erp-date-picker-icon">
                  <i className="fas fa-file-invoice text-[12px]" />
                </span>
              </button>
            </div>

            <DateField
              label="Request Date"
              name="requestDate"
              value={form.requestDate}
              onChange={(nextValue) =>
                setForm((current) => ({
                  ...current,
                  requestDate: nextValue
                }))
              }
            />

            <div>
              <label className="erp-label">Reason</label>
              <select
                value={form.reason}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    reason: event.target.value
                  }))
                }
                className="erp-select"
              >
                <option value="">Select reason</option>
                {reasonOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="erp-label">Disposition</label>
              <select
                value={form.disposition}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    disposition: event.target.value
                  }))
                }
                className="erp-select"
              >
                {dispositionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            <div className="erp-entity-card-panel">
              <div className="flex items-center gap-2 border-b border-[#e3ebf1] pb-2">
                <i className="fas fa-user text-[11px] text-[#0070b8]" />
                <p className="text-[12px] font-bold text-[#1a3557]">Customer Snapshot</p>
              </div>
              {selectedCustomer ? (
                <div className="mt-3 grid gap-2 text-[11px] text-[#546e7a]">
                  <div>
                    <span className="font-bold text-[#1a3557]">{selectedCustomer.name}</span>
                  </div>
                  <div>{selectedCustomer.company || "Personal customer"}</div>
                  <div>{selectedCustomer.email || "No email on file"}</div>
                </div>
              ) : (
                <div className="mt-3 text-[11px] italic text-[#90a4ae]">
                  Select a customer to load invoice history and return context.
                </div>
              )}
            </div>

            <div className="erp-entity-card-panel">
              <div className="flex items-center gap-2 border-b border-[#e3ebf1] pb-2">
                <i className="fas fa-file-lines text-[11px] text-[#0070b8]" />
                <p className="text-[12px] font-bold text-[#1a3557]">Invoice Snapshot</p>
              </div>
              {selectedInvoice ? (
                <div className="mt-3 grid gap-2 text-[11px] text-[#546e7a]">
                  <div className="font-mono font-bold text-[#1a3557]">{selectedInvoice.invoiceNumber}</div>
                  <div>Date: {formatDate(selectedInvoice.invoiceDate)}</div>
                  <div>Total: {formatMoney(selectedInvoice.grandTotal)}</div>
                  <div>Status: {selectedInvoice.status || "N/A"}</div>
                </div>
              ) : (
                <div className="mt-3 text-[11px] italic text-[#90a4ae]">
                  Choose a sales invoice so the return can be tied to original delivered items.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
          <div className="app-shell-card p-4">
            <div className="mb-3 flex items-center gap-2 border-b border-[#e3ebf1] pb-2.5">
              <i className="fas fa-boxes-stacked text-[13px] text-[#0070b8]" />
              <p className="text-[13px] font-bold text-[#1a3557]">
                {selectedInvoice ? "Invoice Items" : "Available Products"}
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
              <div className="relative">
                <i className="fas fa-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-[#90a4ae]" />
                <input
                  value={productSearchInput}
                  onChange={(event) => setProductSearchInput(event.target.value)}
                  className="erp-input pl-8"
                  placeholder={selectedInvoice ? "Search invoice items" : "Search products"}
                />
              </div>

              <select
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value)}
                className="erp-select"
                disabled={Boolean(selectedInvoice)}
              >
                <option value="">{selectedInvoice ? "Invoice-linked items" : "All categories"}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedInvoice ? (
              <div className="mt-3 rounded-sm border border-[#cfe0ee] bg-[#f6fbff] px-3 py-2 text-[11px] text-[#3f6786]">
                Showing only items from invoice <span className="font-mono font-bold">{selectedInvoice.invoiceNumber}</span>.
              </div>
            ) : null}

            <div className="mt-4 max-h-[620px] overflow-y-auto pr-1">
              {isLoadingReferenceData ? (
                <div className="flex min-h-[220px] items-center justify-center text-[11px] italic text-[#90a4ae]">
                  Loading product references...
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="flex min-h-[220px] items-center justify-center text-[11px] italic text-[#90a4ae]">
                  No products found for the current filters.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                  {filteredProducts.map((product) => {
                    const card = getProductCardMeta(product, selectedInvoice);
                    const alreadyAdded = isAdded(card.productVariantId ?? card.productId);
                    const canAdd = Boolean(card.productVariantId);

                    return (
                      <article
                        key={card.id}
                        className={`rounded-sm border p-2.5 transition ${
                          alreadyAdded
                            ? "border-[#0070b8] bg-[#e8f1f8]"
                            : "border-[#d3dee7] bg-[#f8fbfd] hover:border-[#9eb9d0] hover:bg-white"
                        }`}
                      >
                        <div className="flex gap-2.5">
                          <img
                            src={resolveProductImageUrl(card.fileUrl)}
                            alt={card.name}
                            className="h-16 w-16 shrink-0 rounded-sm border border-[#d3dee7] object-cover"
                          />

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[11px] font-bold text-[#1a3557]">{card.name}</p>
                            <p className="mt-0.5 truncate text-[10px] text-[#607d8b]">{card.subtitle}</p>
                            <p className="mt-1 text-[9px] text-[#90a4ae]">
                              {card.categoryName} | {card.stockLabel}
                            </p>
                            <div className="mt-2 flex items-center justify-between gap-2">
                              <p className="text-[11px] font-bold text-[#0070b8]">{formatMoney(card.price)}</p>
                              <button
                                type="button"
                                onClick={() => addItem(product)}
                                disabled={!canAdd || alreadyAdded}
                                className={`inline-flex h-7 items-center justify-center rounded-sm px-2.5 text-[10px] font-bold transition disabled:cursor-not-allowed ${
                                  alreadyAdded
                                    ? "border border-[#0070b8] bg-white text-[#0070b8] disabled:opacity-100"
                                    : "bg-[#0070b8] text-white hover:bg-[#005a94] disabled:bg-[#b0bec5] disabled:text-white"
                                }`}
                              >
                                <i className={`mr-1 text-[10px] ${alreadyAdded ? "fas fa-check" : "fas fa-plus"}`} />
                                {alreadyAdded ? "Added" : canAdd ? "Add" : "Unavailable"}
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
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <i className="fas fa-rotate-left text-[13px] text-[#0070b8]" />
                  <p className="text-[13px] font-bold text-[#1a3557]">Return Items</p>
                </div>

                {form.items.length > 0 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        items: []
                      }))
                    }
                    className="text-[10px] font-bold uppercase text-[#c62828] transition hover:text-[#8d1c1c]"
                  >
                    Clear All
                  </button>
                ) : null}
              </div>

              {form.items.length === 0 ? (
                <div className="flex min-h-[220px] items-center justify-center text-[11px] italic text-[#90a4ae]">
                  Add products from the left panel to build this return request.
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  {form.items.map((item) => {
                    const itemKey = getItemKey(item);

                    return (
                    <article key={itemKey} className="rounded-sm border border-[#d3dee7] bg-[#f8fbfd] px-2 py-2">
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="min-w-0">
                          <p className="truncate text-[11px] font-bold text-[#1a3557]">
                            {item.variantName && item.variantName !== "Default"
                              ? `${item.name} ${item.variantName}`
                              : item.name}
                          </p>
                          <p className="mt-0.5 text-[9px] text-[#90a4ae]">Max quantity {item.maxQuantity}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(itemKey)}
                          className="erp-icon-button-danger"
                          title="Remove item"
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
                              onClick={() => updateItemQty(itemKey, Number(item.quantity) - 1)}
                              disabled={Number(item.quantity) <= 1}
                              className="erp-stepper-button-left"
                            >
                              <i className="fas fa-minus" />
                            </button>
                            <input
                              type="number"
                              min="1"
                              max={item.maxQuantity}
                              value={item.quantity}
                              onChange={(event) => updateItemQty(itemKey, event.target.value)}
                              className="h-8 w-14 border-0 bg-white text-center text-[12px] font-bold text-[#1a3557] outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => updateItemQty(itemKey, Number(item.quantity) + 1)}
                              disabled={Number(item.quantity) >= Number(item.maxQuantity)}
                              className="erp-stepper-button-right"
                            >
                              <i className="fas fa-plus" />
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="erp-label">Unit Price</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(event) => updateItemPrice(itemKey, event.target.value)}
                            className="erp-input"
                          />
                        </div>

                        <div>
                          <label className="erp-label">Restock</label>
                          <button
                            type="button"
                            onClick={() => toggleRestock(itemKey)}
                            className={`inline-flex h-9 w-full items-center justify-center rounded-sm border text-[11px] font-bold transition ${
                              item.restockFlag
                                ? "border-[#9fd0a2] bg-[#eef9ef] text-[#2e7d32]"
                                : "border-[#d3dee7] bg-white text-[#607d8b] hover:border-[#bfd0de]"
                            }`}
                          >
                            <i className={`mr-1.5 ${item.restockFlag ? "fas fa-check-circle" : "fas fa-warehouse"}`} />
                            {item.restockFlag ? "Restock to Inventory" : "Do Not Restock"}
                          </button>
                        </div>
                      </div>

                      <div className="mt-2 flex items-center justify-between text-[11px]">
                        <span className="text-[#607d8b]">Line Total</span>
                        <span className="font-bold text-[#1a3557]">{formatMoney(item.quantity * item.unitPrice)}</span>
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
                <p className="text-[13px] font-bold text-[#1a3557]">Summary & Notes</p>
              </div>

              <div className="mt-4 space-y-2 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-[#607d8b]">Customer</span>
                  <span className="max-w-[55%] truncate text-right font-bold text-[#1a3557]">
                    {selectedCustomer?.name || "Not selected"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#607d8b]">Invoice</span>
                  <span className="font-mono font-bold text-[#1a3557]">
                    {selectedInvoice?.invoiceNumber || "Not selected"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#607d8b]">Disposition</span>
                  <span className="font-bold text-[#1a3557]">{form.disposition}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#607d8b]">Item Count</span>
                  <span className="font-bold text-[#1a3557]">{form.items.length}</span>
                </div>
                <div className="border-t border-[#e3ebf1] pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-bold text-[#1a3557]">Estimated Credit Value</span>
                    <span className="text-[16px] font-bold text-[#0070b8]">{formatMoney(totalAmount)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <label className="erp-label">Audit Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      notes: event.target.value
                    }))
                  }
                  rows={4}
                  className="erp-textarea min-h-[110px]"
                  placeholder="Add receiving notes, inspection remarks, or internal handling instructions..."
                />
              </div>
            </section>
          </aside>
        </section>
      </form>

      <SelectionModal
        show={showCustomerModal}
        title="Select Customer"
        searchPlaceholder="Search customer by name, company, or email..."
        items={customers}
        searchFields={["name", "company", "email"]}
        onClose={() => setShowCustomerModal(false)}
        onSelect={handleSelectCustomer}
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
                  <div className="truncate text-[11px] text-[#607d8b]">{customer.company || "Personal customer"}</div>
                  <div className="truncate text-[10px] text-[#90a4ae]">{customer.email || "No email on file"}</div>
                </div>
                <i className="fas fa-chevron-right text-[10px] text-[#90a4ae]" />
              </button>
            ))}
          </div>
        )}
      />

      <SelectionModal
        show={showInvoiceModal}
        title="Select Sales Invoice"
        searchPlaceholder="Search invoice number..."
        items={invoices}
        searchFields={["invoiceNumber", "status"]}
        onClose={() => setShowInvoiceModal(false)}
        onSelect={handleSelectInvoice}
        renderItems={({ filteredItems, selectItem }) => (
          <div className="flex flex-col">
            {filteredItems.map((invoice) => (
              <button
                key={invoice.id}
                type="button"
                onClick={() => selectItem(invoice)}
                className="flex items-center gap-3 border-b border-[#edf2f6] px-4 py-3 text-left transition hover:bg-[#f6fbff]"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-[#f3f7fb] text-[#5f7b93]">
                  <i className="fas fa-file-invoice text-[15px]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-[13px] font-bold text-[#1a3557]">{invoice.invoiceNumber}</div>
                  <div className="text-[11px] text-[#607d8b]">Date: {formatDate(invoice.invoiceDate)}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[12px] font-bold text-[#0070b8]">{formatMoney(invoice.grandTotal)}</div>
                  <div className="text-[10px] uppercase text-[#607d8b]">{invoice.status || "N/A"}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      />
    </div>
  );
}
