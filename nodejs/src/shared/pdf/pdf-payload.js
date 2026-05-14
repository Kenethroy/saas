import { env } from "#config/env";

function toDateOnly(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function toNumber(value) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

export function buildPdfCompanyPayload() {
  return {
    name: env.PDF_COMPANY_NAME,
    address: env.PDF_COMPANY_ADDRESS,
    phone: env.PDF_COMPANY_PHONE,
    email: env.PDF_COMPANY_EMAIL,
    ...(env.PDF_COMPANY_LOGO_URL ? { logo_url: env.PDF_COMPANY_LOGO_URL } : {})
  };
}

export function buildCustomerStatementPdfPayload(customer, statement) {
  const fromDate = toDateOnly(statement.fromDate);
  const toDate = toDateOnly(statement.toDate);
  const aging = statement.aging ?? {};

  return {
    company: buildPdfCompanyPayload(),
    customer: {
      id: Number(customer.id),
      name: customer.name ?? null,
      company: customer.company ?? null,
      address: customer.address ?? null,
      phone: customer.phone ?? null,
      email: customer.email ?? null
    },
    from_date: fromDate,
    to_date: toDate,
    period: fromDate && toDate ? `${fromDate} - ${toDate}` : undefined,
    document_number: `SOA-C${Number(customer.id) || 0}-${String(fromDate ?? "").replaceAll("-", "")}-${String(toDate ?? "").replaceAll("-", "")}`,
    history: {
      opening_balance: toNumber(statement.openingBalance),
      closing_balance: toNumber(statement.closingBalance),
      transactions: (statement.transactions ?? []).map((transaction) => ({
        date: toDateOnly(transaction.date),
        due_date: toDateOnly(transaction.dueDate),
        description: transaction.description ?? "",
        reference: transaction.reference ?? "",
        debit: toNumber(transaction.debit),
        credit: toNumber(transaction.credit),
        balance: toNumber(transaction.balance)
      }))
    },
    aging: {
      current: toNumber(aging.current),
      not_yet_due: toNumber(aging.current),
      "1_30": toNumber(aging.days_1_30),
      "31_60": toNumber(aging.days_31_60),
      "61_90": toNumber(aging.days_61_90),
      "91_above": toNumber(aging.over_90),
      amount_due_now: toNumber(aging.total) - toNumber(aging.current)
    }
  };
}

