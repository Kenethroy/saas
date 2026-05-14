const STATUS_ORDER = ["pending", "in_transit", "delivered"];

const statusRank = STATUS_ORDER.reduce((acc, status, index) => {
  acc[status] = index;
  return acc;
}, {});

export function getAllowedDeliveryStatuses(currentStatus) {
  if (!currentStatus) {
    return [...STATUS_ORDER, "cancelled"];
  }

  if (currentStatus === "cancelled" || currentStatus === "delivered") {
    return [currentStatus];
  }

  const rank = statusRank[currentStatus];
  if (!Number.isInteger(rank)) {
    return [...STATUS_ORDER, "cancelled"];
  }

  return [...STATUS_ORDER.slice(rank), "cancelled"];
}

export function canEditDelivery(status) {
  return status === "pending";
}
