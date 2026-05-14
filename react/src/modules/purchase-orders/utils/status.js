export function getAllowedPurchaseOrderStatuses(currentStatus) {
  switch (currentStatus) {
    case "pending":
      return ["pending", "approved", "cancelled"];
    case "approved":
      return ["approved", "received", "cancelled"];
    case "received":
    case "cancelled":
      return [currentStatus];
    default:
      return [];
  }
}

export function canEditPurchaseOrder(status) {
  return status === "pending";
}
