const STATUS_ORDER = ["draft", "sent", "accepted", "rejected", "expired", "converted"];

export function getAllowedQuotationStatuses(currentStatus) {
  if (!currentStatus) {
    return STATUS_ORDER;
  }

  if (currentStatus === "converted") {
    return ["converted"];
  }

  if (currentStatus === "draft") {
    return ["draft", "sent", "expired"];
  }

  if (currentStatus === "sent") {
    return ["sent", "accepted", "rejected", "expired"];
  }

  if (currentStatus === "accepted") {
    return ["accepted", "expired"];
  }

  if (currentStatus === "rejected") {
    return ["rejected"];
  }

  if (currentStatus === "expired") {
    return ["expired"];
  }

  return STATUS_ORDER;
}

export function canEditQuotation(currentStatus) {
  return currentStatus === "draft" || currentStatus === "sent";
}

export function canDeleteQuotation(currentStatus) {
  return currentStatus === "draft" || currentStatus === "rejected" || currentStatus === "expired";
}
