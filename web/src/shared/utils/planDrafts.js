function toNullableText(value) {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : null;
}

function toNullableInput(value) {
  return value === null || value === undefined ? "" : String(value);
}

export function toPriceDraft(price) {
  return {
    ...price,
    name: price.name ?? "",
    description: price.description ?? "",
    priceInput: toNullableInput(price.price),
    providerPriceId: price.providerPriceId ?? ""
  };
}

export function toPlanDraft(plan) {
  return {
    ...plan,
    name: plan.name ?? "",
    description: plan.description ?? "",
    priceMonthlyInput: toNullableInput(plan.priceMonthly),
    priceYearlyInput: toNullableInput(plan.priceYearly),
    maxBranchesInput: toNullableInput(plan.maxBranches),
    maxUsersInput: toNullableInput(plan.maxUsers),
    maxProductsInput: toNullableInput(plan.maxProducts),
    maxStorageGbInput: toNullableInput(plan.maxStorageGb),
    prices: Array.isArray(plan.prices) ? plan.prices.map(toPriceDraft) : []
  };
}

export function buildPlanPayload(plan) {
  return {
    name: plan.name.trim(),
    description: toNullableText(plan.description),
    priceMonthly: plan.priceMonthlyInput === "" ? null : plan.priceMonthlyInput,
    priceYearly: plan.priceYearlyInput === "" ? null : plan.priceYearlyInput,
    maxBranches: plan.maxBranchesInput === "" ? null : plan.maxBranchesInput,
    maxUsers: plan.maxUsersInput === "" ? null : plan.maxUsersInput,
    maxProducts: plan.maxProductsInput === "" ? null : plan.maxProductsInput,
    maxStorageGb: plan.maxStorageGbInput === "" ? null : plan.maxStorageGbInput,
    allowReports: Boolean(plan.allowReports),
    allowBackup: Boolean(plan.allowBackup),
    allowApiAccess: Boolean(plan.allowApiAccess),
    allowMultiBranch: Boolean(plan.allowMultiBranch),
    isActive: Boolean(plan.isActive)
  };
}

export function buildPlanPricePayload(price) {
  return {
    name: price.name.trim(),
    description: toNullableText(price.description),
    checkoutMode: price.checkoutMode,
    price: price.priceInput === "" ? null : price.priceInput,
    providerPriceId: toNullableText(price.providerPriceId),
    isActive: Boolean(price.isActive)
  };
}
