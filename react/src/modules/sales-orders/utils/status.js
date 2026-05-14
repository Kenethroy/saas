const STATUS_ORDER = ["pending", "processing", "for_delivery", "delivered", "completed"];

const statusRank = STATUS_ORDER.reduce((acc, status, index) => {
  acc[status] = index;
  return acc;
}, {});

export function getAllowedSalesOrderStatuses(currentStatus) {
  if (!currentStatus) {
    return STATUS_ORDER.filter((status) => status !== "for_delivery");
  }

  if (currentStatus === "cancelled" || currentStatus === "completed") {
    return [currentStatus];
  }

  if (currentStatus === "delivered") {
    return ["delivered", "completed"];
  }

  if (currentStatus === "for_delivery") {
    return ["for_delivery", "cancelled"];
  }

  const rank = statusRank[currentStatus];
  if (!Number.isInteger(rank)) {
    return STATUS_ORDER.filter((status) => status !== "for_delivery");
  }

  const forwardStatuses = STATUS_ORDER.slice(rank);
  const visibleForwardStatuses = currentStatus === "for_delivery" || currentStatus === "processing"
    ? forwardStatuses
    : forwardStatuses.filter((status) => status !== "for_delivery");

  return [...visibleForwardStatuses, "cancelled"];
}

export function canEditSalesOrder(currentStatus) {
  return currentStatus === "pending" || currentStatus === "processing";
}
