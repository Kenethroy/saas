USE `jrspc_node`;

-- Add payslip_id to business_expenses (safe: only if column doesn't already exist)
SET @col_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'jrspc_node'
    AND TABLE_NAME = 'business_expenses'
    AND COLUMN_NAME = 'payslip_id'
);

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE `business_expenses`
     ADD COLUMN `payslip_id` BIGINT UNSIGNED NULL DEFAULT NULL AFTER `recurring_expense_id`,
     ADD KEY `idx_business_expenses_payslip_id` (`payslip_id`),
     ADD CONSTRAINT `fk_business_expenses_payslip_id`
       FOREIGN KEY (`payslip_id`) REFERENCES `payslips` (`id`)
       ON DELETE SET NULL
       ON UPDATE CASCADE',
  'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
