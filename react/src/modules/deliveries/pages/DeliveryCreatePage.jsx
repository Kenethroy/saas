import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { DateField } from "@/shared/components/common/DateField";
import { Skeleton } from "@/shared/components/common/Skeleton";
import { useNotification } from "@/shared/hooks/useNotification";
import {
  createDelivery,
  getDeliveryById,
  getDeliverySelectionOptions,
  updateDelivery
} from "@/modules/deliveries/api/deliveries.api";
import { canEditDelivery } from "@/modules/deliveries/utils/status";

function formatMoney(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2
  }).format(Number(value ?? 0));
}

const initialForm = {
  salesOrderIds: [],
  deliveryDate: new Date().toISOString().slice(0, 10),
  driverId: "",
  truckId: "",
  notes: ""
};

function normalizeSalesOrderOption(order) {
  if (!order) return null;

  const normalizedId = Number(
    order.salesOrderId ??
    order.sales_order_id ??
    order.id
  );

  return {
    id: normalizedId,
    salesOrderNumber: order.salesOrderNumber ?? order.salesOrder?.salesOrderNumber ?? order.sales_order_number ?? "N/A",
    customerName: order.customerName ?? order.salesOrder?.customer?.name ?? order.customer_name ?? "N/A",
    customerAddress: order.customerAddress ?? order.salesOrder?.customer?.address ?? order.customer_address ?? null,
    customerPhone: order.customerPhone ?? order.salesOrder?.customer?.phone ?? order.customer_phone ?? null,
    customerEmail: order.customerEmail ?? order.salesOrder?.customer?.email ?? order.customer_email ?? null,
    totalAmount: Number(order.totalAmount ?? order.salesOrder?.totalAmount ?? order.total_amount ?? 0)
  };
}

export function DeliveryCreatePage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEditMode = Boolean(id);
  const notify = useNotification();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [hasAppliedPreselection, setHasAppliedPreselection] = useState(false);
  const preselectedSalesOrderId = Number(searchParams.get("salesOrderId"));

  const { data: selectionResponse, isLoading: isSelectionLoading } = useQuery({
    queryKey: ["delivery-selection-options"],
    queryFn: getDeliverySelectionOptions
  });

  const { data: deliveryResponse, isLoading: isDeliveryLoading } = useQuery({
    queryKey: ["delivery", id],
    enabled: isEditMode,
    queryFn: () => getDeliveryById(id)
  });

  const delivery = deliveryResponse?.data ?? null;
  const selectionData = selectionResponse?.data ?? {};
  const availableSalesOrders = selectionData.salesOrders ?? [];
  const drivers = selectionData.drivers ?? [];
  const trucks = selectionData.trucks ?? [];

  useEffect(() => {
    if (!delivery || !isEditMode) return;

    setForm({
      salesOrderIds: (delivery.salesOrders ?? []).map((salesOrder) => Number(salesOrder.salesOrderId ?? salesOrder.id)),
      deliveryDate: delivery.deliveryDate?.slice(0, 10) ?? initialForm.deliveryDate,
      driverId: delivery.driverId ? String(delivery.driverId) : "",
      truckId: delivery.truckId ? String(delivery.truckId) : "",
      notes: delivery.notes ?? ""
    });
  }, [delivery, isEditMode]);

  const selectableSalesOrders = useMemo(() => {
    const merged = new Map();

    availableSalesOrders.forEach((order) => {
      const normalized = normalizeSalesOrderOption(order);
      if (normalized) {
        merged.set(normalized.id, normalized);
      }
    });

    if (isEditMode) {
      (delivery?.salesOrders ?? []).forEach((order) => {
        const normalized = normalizeSalesOrderOption(order);
        if (normalized) {
          merged.set(normalized.id, normalized);
        }
      });
    }

    return Array.from(merged.values());
  }, [availableSalesOrders, delivery?.salesOrders, isEditMode]);

  const selectedSalesOrders = useMemo(
    () => selectableSalesOrders.filter((order) => form.salesOrderIds.includes(order.id)),
    [form.salesOrderIds, selectableSalesOrders]
  );

  useEffect(() => {
    if (isEditMode || hasAppliedPreselection || !Number.isInteger(preselectedSalesOrderId) || preselectedSalesOrderId <= 0) {
      return;
    }

    const orderExists = selectableSalesOrders.some((order) => order.id === preselectedSalesOrderId);
    if (!orderExists) {
      return;
    }

    setForm((current) => ({
      ...current,
      salesOrderIds: current.salesOrderIds.includes(preselectedSalesOrderId)
        ? current.salesOrderIds
        : [...current.salesOrderIds, preselectedSalesOrderId]
    }));
    setHasAppliedPreselection(true);
  }, [hasAppliedPreselection, isEditMode, preselectedSalesOrderId, selectableSalesOrders]);

  const saveMutation = useMutation({
    mutationFn: (payload) => {
      if (isEditMode) {
        return updateDelivery(id, payload);
      }

      return createDelivery(payload);
    },
    onSuccess: async (response) => {
      notify.success(isEditMode ? "Delivery updated successfully" : "Delivery created successfully");
      await queryClient.invalidateQueries({ queryKey: ["deliveries"] });
      await queryClient.invalidateQueries({ queryKey: ["delivery-selection-options"] });
      const targetId = response?.data?.id ?? id;
      navigate(targetId ? `/deliveries/${targetId}` : "/deliveries");
    },
    onError: (error) => {
      notify.error(error?.response?.data?.message ?? "Failed to save delivery.");
    }
  });

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value
    }));

    setErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function toggleSalesOrder(orderId) {
    setForm((current) => ({
      ...current,
      salesOrderIds: current.salesOrderIds.includes(orderId)
        ? current.salesOrderIds.filter((value) => value !== orderId)
        : [...current.salesOrderIds, orderId]
    }));

    setErrors((current) => {
      const next = { ...current };
      delete next.salesOrderIds;
      return next;
    });
  }

  function validate() {
    const nextErrors = {};

    if (form.salesOrderIds.length === 0) {
      nextErrors.salesOrderIds = "Select at least one sales order.";
    }

    if (!form.deliveryDate) {
      nextErrors.deliveryDate = "Delivery date is required.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!validate()) return;

    const payload = {
      deliveryDate: form.deliveryDate,
      driverId: form.driverId ? Number(form.driverId) : null,
      truckId: form.truckId ? Number(form.truckId) : null,
      notes: form.notes?.trim() || null
    };

    payload.salesOrderIds = form.salesOrderIds;

    await saveMutation.mutateAsync(payload);
  }

  const isLoading = isSelectionLoading || (isEditMode && isDeliveryLoading);
  const isLocked = isEditMode && delivery && !canEditDelivery(delivery.status);

  return (
    <div className="space-y-4">
      <section className="erp-page-section">
        <div className="erp-page-header">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(isEditMode && id ? `/deliveries/${id}` : "/deliveries")}
              className="erp-back-button"
            >
              <i className="fas fa-arrow-left text-[12px]" />
            </button>
            <div>
              <div className="erp-page-title">{isEditMode ? "Edit Delivery" : "Create Delivery"}</div>
              <div className="erp-page-description">Batch sales orders for dispatch and delivery scheduling</div>
            </div>
          </div>
          <button
            type="submit"
            form="delivery-form"
            disabled={saveMutation.isPending || isLoading || isLocked}
            className="erp-header-primary-button disabled:cursor-not-allowed disabled:bg-[#89a9c1]"
          >
            <i className="fas fa-save mr-1.5" />
            {saveMutation.isPending ? "Saving..." : isEditMode ? "Update Delivery" : "Create Delivery"}
          </button>
        </div>
      </section>

      {isLocked ? (
        <section className="rounded-sm border border-[#ffe082] bg-[#fff8e1] px-4 py-3 text-[11px] text-[#8d6e00]">
          Only pending deliveries can be edited. Use the delivery view page to update status instead.
        </section>
      ) : null}

      <form id="delivery-form" onSubmit={handleSubmit} className="space-y-4 erp-form-stack">
        <section className="erp-page-main-card p-4">
          <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.6px] text-[#607d8b]">Sales Orders</div>
          {errors.salesOrderIds ? <div className="mb-3 text-[10px] text-[#c62828]">{errors.salesOrderIds}</div> : null}

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={`delivery-so-sk-${index}`} className="h-16 w-full" />
              ))}
            </div>
          ) : selectableSalesOrders.length === 0 ? (
            <div className="rounded-sm border border-dashed border-[#d3dee7] bg-[#f8fbfd] px-4 py-10 text-center text-[11px] text-[#90a4ae]">
              No sales orders are currently available for delivery scheduling.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-sm border border-[#e3ebf1]">
              <table className="w-full min-w-[780px] text-[11px]">
                <thead className="bg-[#f3f6f9]">
                  <tr className="text-left text-[10px] font-bold uppercase tracking-[0.6px] text-[#546e7a]">
                    <th className="px-3 py-2 text-center">Select</th>
                    <th className="px-3 py-2">SO Number</th>
                    <th className="px-3 py-2">Customer</th>
                    <th className="px-3 py-2">Address</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {selectableSalesOrders.map((order) => {
                    const checked = form.salesOrderIds.includes(order.id);
                    return (
                      <tr
                        key={order.id}
                        className={`border-t border-[#e3ebf1] transition ${checked ? "bg-[#eef5fa]" : "hover:bg-[#f8fbfd]"}`}
                      >
                        <td className="px-3 py-2 text-center">
                          <input type="checkbox" checked={checked} onChange={() => toggleSalesOrder(order.id)} />
                        </td>
                        <td className="px-3 py-2 font-mono font-bold text-[#0070b8]">{order.salesOrderNumber}</td>
                        <td className="px-3 py-2">
                          <div className="font-bold text-[#1a3557]">{order.customerName}</div>
                          <div className="text-[10px] text-[#90a4ae]">{order.customerPhone || "No contact"}</div>
                        </td>
                        <td className="px-3 py-2 text-[#607d8b]">{order.customerAddress || "N/A"}</td>
                        <td className="px-3 py-2 text-right font-bold text-[#1a3557]">{formatMoney(order.totalAmount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="app-shell-card p-4">
          <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.6px] text-[#607d8b]">Delivery Details</div>

          <div className="grid gap-4 md:grid-cols-3">
            <DateField
              label="Delivery Date"
              value={form.deliveryDate}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(value) => updateField("deliveryDate", value)}
              error={errors.deliveryDate}
            />

            <div>
              <label className="erp-label">Driver</label>
              <select value={form.driverId} onChange={(event) => updateField("driverId", event.target.value)} className="erp-select">
                <option value="">Unassigned</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.name || `Employee #${driver.id}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="erp-label">Truck</label>
              <select value={form.truckId} onChange={(event) => updateField("truckId", event.target.value)} className="erp-select">
                <option value="">Unassigned</option>
                {trucks.map((truck) => (
                  <option key={truck.id} value={truck.id}>
                    {truck.plateNumber}{truck.model ? ` - ${truck.model}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className="erp-label">Notes</label>
            <textarea
              value={form.notes}
              onChange={(event) => updateField("notes", event.target.value)}
              rows={4}
              className="erp-input min-h-[108px] resize-y"
              placeholder="Dispatch notes, route reminders, or special handling instructions..."
            />
          </div>
        </section>
      </form>
    </div>
  );
}
