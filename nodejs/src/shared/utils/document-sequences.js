import { transaction } from "#shared/database/mysql";
import { AppError } from "#shared/utils/app-error";

function getYearMonth(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return { year, month };
}

function shouldReset(policy, lastResetAt, now) {
  if (!policy || policy === "none") return false;
  if (!lastResetAt) return true;

  const last = lastResetAt instanceof Date ? lastResetAt : new Date(lastResetAt);
  if (Number.isNaN(last.getTime())) return true;

  const nowParts = getYearMonth(now);
  const lastParts = getYearMonth(last);

  if (policy === "yearly") {
    return nowParts.year !== lastParts.year;
  }
  if (policy === "monthly") {
    return nowParts.year !== lastParts.year || nowParts.month !== lastParts.month;
  }

  return false;
}

function formatDocumentNumber({ prefix, padding, policy, atDate, number }) {
  const padded = String(number).padStart(Math.max(1, Number(padding) || 0), "0");

  if (policy === "yearly") {
    const year = atDate.getFullYear();
    return `${prefix}-${year}-${padded}`;
  }

  if (policy === "monthly") {
    const { year, month } = getYearMonth(atDate);
    return `${prefix}-${year}${month}-${padded}`;
  }

  return `${prefix}-${padded}`;
}

export async function allocateDocumentNumber({
  tenantId,
  branchId,
  documentType,
  at = new Date(),
  tx: txClient = null
}) {
  const normalizedTenantId = Number(tenantId);
  const normalizedBranchId = branchId ? Number(branchId) : null;

  if (!normalizedTenantId) throw new AppError("Tenant context is required", 400);
  if (!documentType || typeof documentType !== "string") throw new AppError("Invalid document type", 400);

  const atDate = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(atDate.getTime())) {
    throw new AppError("Invalid date", 400);
  }

  const allocateInTx = async (tx) => {
    let effectiveBranchId = normalizedBranchId;
    if (!effectiveBranchId) {
      const [branchRows] = await tx.execute(
        `
          SELECT id
          FROM branches
          WHERE tenant_id = ?
            AND is_primary = 1
          LIMIT 1
        `,
        [normalizedTenantId]
      );
      effectiveBranchId = branchRows[0]?.id ? Number(branchRows[0].id) : null;
    }

    if (!effectiveBranchId) {
      throw new AppError("Branch context is required", 400);
    }

    const [rows] = await tx.execute(
      `
        SELECT id, prefix, next_number, number_padding, reset_policy, last_reset_at, status
        FROM document_sequences
        WHERE tenant_id = ?
          AND branch_id = ?
          AND document_type = ?
        LIMIT 1
        FOR UPDATE
      `,
      [normalizedTenantId, effectiveBranchId, documentType]
    );

    const seq = rows[0];
    if (!seq || seq.status !== "active") {
      throw new AppError("Document sequence not configured", 409);
    }

    const prefix = String(seq.prefix ?? "").trim();
    if (!prefix) {
      throw new AppError("Document sequence prefix is required", 409);
    }

    const policy = seq.reset_policy ?? "none";
    const doReset = shouldReset(policy, seq.last_reset_at, atDate);
    const currentNumber = doReset ? 1 : Number(seq.next_number ?? 1);

    const nextNumber = currentNumber + 1;
    await tx.execute(
      `
        UPDATE document_sequences
        SET next_number = ?,
            last_reset_at = ?,
            updated_at = NOW()
        WHERE id = ?
      `,
      [nextNumber, atDate, Number(seq.id)]
    );

    return formatDocumentNumber({
      prefix,
      padding: Number(seq.number_padding ?? 5),
      policy,
      atDate,
      number: currentNumber
    });
  };

  if (txClient) {
    return allocateInTx(txClient);
  }

  return transaction(async (tx) => allocateInTx(tx));
}
