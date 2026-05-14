export function toMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}
