import { query } from "#shared/database/mysql";
import { AppError } from "#shared/utils/app-error";

function normalizeVariantIds(variantIds = []) {
  return [...new Set(
    variantIds
      .map((variantId) => Number(variantId))
      .filter((variantId) => Number.isInteger(variantId) && variantId > 0)
  )];
}

async function execute(executor, sql, params = []) {
  if (executor?.execute) {
    const [rows] = await executor.execute(sql, params);
    return rows;
  }

  return query(sql, params);
}

async function resolvePrimaryBranchId(executor, tenantId) {
  const rows = await execute(
    executor,
    `
      SELECT id
      FROM branches
      WHERE tenant_id = ?
        AND is_primary = 1
        AND status = 'active'
      LIMIT 1
    `,
    [Number(tenantId)]
  );

  return rows[0]?.id ? Number(rows[0].id) : null;
}

export async function resolveEffectiveBranchId(executor, tenantId, branchId = null) {
  const normalizedBranchId = branchId ? Number(branchId) : null;
  if (normalizedBranchId) {
    return normalizedBranchId;
  }

  return resolvePrimaryBranchId(executor, tenantId);
}

export async function ensureBranchInventoryBalances(executor, { tenantId, branchId = null, variantIds = [] } = {}) {
  const normalizedTenantId = Number(tenantId);
  const normalizedVariantIds = normalizeVariantIds(variantIds);

  if (!normalizedTenantId || normalizedVariantIds.length === 0) {
    return branchId ? Number(branchId) : null;
  }

  const effectiveBranchId = await resolveEffectiveBranchId(executor, normalizedTenantId, branchId);
  if (!effectiveBranchId) {
    return null;
  }

  const variants = await execute(
    executor,
    `
      SELECT id, product_id, stock_quantity, reorder_level
      FROM product_variants
      WHERE tenant_id = ?
        AND id IN (?)
        AND delete_flg = 0
    `,
    [normalizedTenantId, normalizedVariantIds]
  );

  if (!variants.length) {
    return effectiveBranchId;
  }

  const primaryBranchId = await resolvePrimaryBranchId(executor, normalizedTenantId);
  const balanceRows = await execute(
    executor,
    `
      SELECT product_variant_id, branch_id
      FROM branch_inventory_balances
      WHERE tenant_id = ?
        AND product_variant_id IN (?)
    `,
    [normalizedTenantId, normalizedVariantIds]
  );

  const branchIdsByVariantId = new Map();
  for (const row of balanceRows) {
    const variantId = Number(row.product_variant_id);
    if (!branchIdsByVariantId.has(variantId)) {
      branchIdsByVariantId.set(variantId, new Set());
    }
    branchIdsByVariantId.get(variantId).add(Number(row.branch_id));
  }

  if (primaryBranchId) {
    for (const variant of variants) {
      const variantId = Number(variant.id);
      const branchIds = branchIdsByVariantId.get(variantId);
      if (branchIds?.size) {
        continue;
      }

      await execute(
        executor,
        `
          INSERT INTO branch_inventory_balances (
            tenant_id, branch_id, product_id, product_variant_id, on_hand_qty, reserved_qty, reorder_level, last_counted_at
          ) VALUES (?, ?, ?, ?, ?, 0, ?, NULL)
        `,
        [
          normalizedTenantId,
          primaryBranchId,
          Number(variant.product_id),
          variantId,
          Number(variant.stock_quantity ?? 0),
          Number(variant.reorder_level ?? 0)
        ]
      );

      branchIdsByVariantId.set(variantId, new Set([primaryBranchId]));
    }
  }

  for (const variant of variants) {
    const variantId = Number(variant.id);
    const branchIds = branchIdsByVariantId.get(variantId) ?? new Set();
    if (branchIds.has(effectiveBranchId)) {
      continue;
    }

    await execute(
      executor,
      `
        INSERT INTO branch_inventory_balances (
          tenant_id, branch_id, product_id, product_variant_id, on_hand_qty, reserved_qty, reorder_level, last_counted_at
        ) VALUES (?, ?, ?, ?, 0, 0, ?, NULL)
      `,
      [
        normalizedTenantId,
        effectiveBranchId,
        Number(variant.product_id),
        variantId,
        Number(variant.reorder_level ?? 0)
      ]
    );
  }

  return effectiveBranchId;
}

export async function getBranchInventoryQuantities({ tenantId, branchId = null, variantIds = [], executor = null } = {}) {
  const normalizedTenantId = Number(tenantId);
  const normalizedVariantIds = normalizeVariantIds(variantIds);
  const effectiveBranchId = await ensureBranchInventoryBalances(executor, {
    tenantId: normalizedTenantId,
    branchId,
    variantIds: normalizedVariantIds
  });

  if (!effectiveBranchId || normalizedVariantIds.length === 0) {
    return { branchId: effectiveBranchId, quantities: new Map() };
  }

  const rows = await execute(
    executor,
    `
      SELECT product_variant_id, on_hand_qty
      FROM branch_inventory_balances
      WHERE tenant_id = ?
        AND branch_id = ?
        AND product_variant_id IN (?)
    `,
    [normalizedTenantId, effectiveBranchId, normalizedVariantIds]
  );

  return {
    branchId: effectiveBranchId,
    quantities: new Map(
      rows.map((row) => [Number(row.product_variant_id), Number(row.on_hand_qty ?? 0)])
    )
  };
}

export async function syncVariantAggregateStock(executor, { tenantId, productVariantId } = {}) {
  await execute(
    executor,
    `
      UPDATE product_variants pv
      SET stock_quantity = (
        SELECT COALESCE(SUM(bib.on_hand_qty), 0)
        FROM branch_inventory_balances bib
        WHERE bib.tenant_id = pv.tenant_id
          AND bib.product_variant_id = pv.id
      )
      WHERE pv.tenant_id = ?
        AND pv.id = ?
    `,
    [Number(tenantId), Number(productVariantId)]
  );
}

export async function applyBranchInventoryDelta(executor, {
  tenantId,
  branchId = null,
  productVariantId,
  quantityChange
} = {}) {
  const normalizedTenantId = Number(tenantId);
  const normalizedVariantId = Number(productVariantId);
  const normalizedChange = Number(quantityChange ?? 0);

  if (!normalizedTenantId || !normalizedVariantId) {
    throw new AppError("Tenant and product variant are required for branch inventory.", 400);
  }

  const effectiveBranchId = await ensureBranchInventoryBalances(executor, {
    tenantId: normalizedTenantId,
    branchId,
    variantIds: [normalizedVariantId]
  });

  if (!effectiveBranchId) {
    throw new AppError("Branch context is required for inventory movement.", 422);
  }

  const rows = await execute(
    executor,
    `
      SELECT id, product_id, on_hand_qty
      FROM branch_inventory_balances
      WHERE tenant_id = ?
        AND branch_id = ?
        AND product_variant_id = ?
      LIMIT 1
    `,
    [normalizedTenantId, effectiveBranchId, normalizedVariantId]
  );

  const balance = rows[0];
  if (!balance) {
    throw new AppError("Branch inventory balance not found.", 404);
  }

  const quantityBefore = Number(balance.on_hand_qty ?? 0);
  const quantityAfter = quantityBefore + normalizedChange;
  if (!Number.isFinite(quantityAfter) || quantityAfter < 0) {
    throw new AppError("Branch inventory adjustment would result in negative stock.", 422);
  }

  await execute(
    executor,
    `
      UPDATE branch_inventory_balances
      SET on_hand_qty = ?
      WHERE tenant_id = ?
        AND id = ?
    `,
    [quantityAfter, normalizedTenantId, Number(balance.id)]
  );

  await syncVariantAggregateStock(executor, {
    tenantId: normalizedTenantId,
    productVariantId: normalizedVariantId
  });

  return {
    branchId: effectiveBranchId,
    productId: Number(balance.product_id),
    quantityBefore,
    quantityAfter
  };
}
