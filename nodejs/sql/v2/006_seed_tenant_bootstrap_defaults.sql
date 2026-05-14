USE `saas`;

DROP PROCEDURE IF EXISTS `sp_seed_tenant_bootstrap_defaults`;

DELIMITER $$

CREATE PROCEDURE `sp_seed_tenant_bootstrap_defaults`(
  IN p_tenant_id BIGINT UNSIGNED,
  IN p_primary_branch_id BIGINT UNSIGNED
)
BEGIN
  INSERT INTO `payment_terms` (
    `tenant_id`, `name`, `days`, `status`, `delete_flg`,
    `created_at`, `updated_at`
  )
  SELECT p_tenant_id, seed.`name`, seed.`days`, 1, 0, NOW(), NOW()
  FROM (
    SELECT 'Cash on Delivery' AS `name`, 0 AS `days`
    UNION ALL SELECT 'Due on Receipt', 0
    UNION ALL SELECT 'Net 15 Days', 15
    UNION ALL SELECT 'Net 30 Days', 30
    UNION ALL SELECT 'Net 60 Days', 60
  ) seed
  WHERE NOT EXISTS (
    SELECT 1
    FROM `payment_terms` pt
    WHERE pt.`tenant_id` = p_tenant_id
      AND pt.`name` = seed.`name`
  );

  INSERT INTO `expense_categories` (
    `tenant_id`, `parent_id`, `name`, `description`, `sort_order`,
    `status`, `delete_flg`, `created_at`, `updated_at`
  )
  SELECT p_tenant_id, NULL, seed.`name`, seed.`description`, seed.`sort_order`, 1, 0, NOW(), NOW()
  FROM (
    SELECT 'Facility & Storage' AS `name`, 'Costs related to storefront, warehouse, and physical business space.' AS `description`, 10 AS `sort_order`
    UNION ALL SELECT 'Logistics & Distribution', 'Costs of moving inventory and completing deliveries.', 20
    UNION ALL SELECT 'Personnel & Labor', 'Salary, payroll, and workforce-related operating costs.', 30
    UNION ALL SELECT 'Financial Charges', 'Bank charges, financing costs, and other non-operational fees.', 40
    UNION ALL SELECT 'Sales & Marketing', 'Advertising and commercial growth spending.', 50
    UNION ALL SELECT 'Administrative & General', 'Day-to-day office and overhead spending.', 60
    UNION ALL SELECT 'Non-Cash Adjustments', 'Accounting-only costs such as depreciation.', 70
  ) seed
  WHERE NOT EXISTS (
    SELECT 1
    FROM `expense_categories` ec
    WHERE ec.`tenant_id` = p_tenant_id
      AND ec.`parent_id` IS NULL
      AND ec.`name` = seed.`name`
  );

  INSERT INTO `document_sequences` (
    `tenant_id`, `branch_id`, `document_type`, `prefix`,
    `next_number`, `number_padding`, `reset_policy`,
    `status`, `created_at`, `updated_at`
  )
  SELECT p_tenant_id, p_primary_branch_id, seed.`document_type`, seed.`prefix`,
    1, 5, seed.`reset_policy`, 'active', NOW(), NOW()
  FROM (
    SELECT 'sales_order' AS `document_type`, 'SO' AS `prefix`, 'yearly' AS `reset_policy`
    UNION ALL SELECT 'purchase_order', 'PO', 'yearly'
    UNION ALL SELECT 'quotation', 'QT', 'yearly'
    UNION ALL SELECT 'delivery', 'DR', 'yearly'
    UNION ALL SELECT 'invoice', 'INV', 'yearly'
    UNION ALL SELECT 'customer_payment', 'PAY', 'yearly'
    UNION ALL SELECT 'supplier_payment', 'SPAY', 'yearly'
    UNION ALL SELECT 'customer_return', 'RMA', 'yearly'
    UNION ALL SELECT 'inventory_adjustment', 'ADJ', 'yearly'
    UNION ALL SELECT 'payslip', 'PS', 'monthly'
  ) seed
  WHERE NOT EXISTS (
    SELECT 1
    FROM `document_sequences` ds
    WHERE ds.`tenant_id` = p_tenant_id
      AND ds.`branch_id` = p_primary_branch_id
      AND ds.`document_type` = seed.`document_type`
  );
END$$

DELIMITER ;
