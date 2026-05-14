USE `jrspc_node`;

CREATE TABLE IF NOT EXISTS `expense_categories` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `parent_id` INT NULL,
  `name` VARCHAR(100) NOT NULL,
  `description` TEXT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `status` TINYINT(1) NOT NULL DEFAULT 1,
  `delete_flg` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) NULL,
  `updated_ip` VARCHAR(45) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_expense_categories_parent_name` (`parent_id`, `name`),
  KEY `idx_expense_categories_parent_id` (`parent_id`),
  KEY `idx_expense_categories_status` (`status`),
  KEY `idx_expense_categories_delete_flg` (`delete_flg`),
  CONSTRAINT `fk_expense_categories_parent_id`
    FOREIGN KEY (`parent_id`) REFERENCES `expense_categories` (`id`)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `recurring_business_expenses` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `category_id` INT NOT NULL,
  `amount` DECIMAL(15,2) NOT NULL,
  `description` TEXT NULL,
  `payee` VARCHAR(255) NULL,
  `payment_method` ENUM('cash','cheque','bank_transfer','credit_card','other') NOT NULL DEFAULT 'cash',
  `frequency` ENUM('daily','weekly','monthly','annually') NOT NULL DEFAULT 'monthly',
  `day_of_month` INT NULL,
  `day_of_week` INT NULL,
  `month_of_year` INT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `last_run_date` DATE NULL,
  `next_run_date` DATE NULL,
  `created_by` BIGINT UNSIGNED NULL,
  `delete_flg` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) NULL,
  `updated_ip` VARCHAR(45) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_recurring_business_expenses_category_id` (`category_id`),
  KEY `idx_recurring_business_expenses_frequency` (`frequency`),
  KEY `idx_recurring_business_expenses_is_active` (`is_active`),
  KEY `idx_recurring_business_expenses_next_run_date` (`next_run_date`),
  KEY `idx_recurring_business_expenses_delete_flg` (`delete_flg`),
  KEY `idx_recurring_business_expenses_created_by` (`created_by`),
  CONSTRAINT `fk_recurring_business_expenses_category_id`
    FOREIGN KEY (`category_id`) REFERENCES `expense_categories` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `business_expenses` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `category_id` INT NOT NULL,
  `recurring_expense_id` BIGINT UNSIGNED NULL,
  `amount` DECIMAL(15,2) NOT NULL,
  `expense_date` DATE NOT NULL,
  `description` TEXT NULL,
  `payee` VARCHAR(255) NULL,
  `payment_method` ENUM('cash','cheque','bank_transfer','credit_card','other') NOT NULL DEFAULT 'cash',
  `reference_number` VARCHAR(100) NULL,
  `attachment_url` VARCHAR(255) NULL,
  `status` ENUM('draft','pending','paid','void') NOT NULL DEFAULT 'paid',
  `created_by` BIGINT UNSIGNED NULL,
  `delete_flg` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) NULL,
  `updated_ip` VARCHAR(45) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_business_expenses_category_id` (`category_id`),
  KEY `idx_business_expenses_recurring_expense_id` (`recurring_expense_id`),
  KEY `idx_business_expenses_expense_date` (`expense_date`),
  KEY `idx_business_expenses_status` (`status`),
  KEY `idx_business_expenses_delete_flg` (`delete_flg`),
  KEY `idx_business_expenses_created_by` (`created_by`),
  CONSTRAINT `fk_business_expenses_category_id`
    FOREIGN KEY (`category_id`) REFERENCES `expense_categories` (`id`),
  CONSTRAINT `fk_business_expenses_recurring_expense_id`
    FOREIGN KEY (`recurring_expense_id`) REFERENCES `recurring_business_expenses` (`id`)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `permissions` (`slug`, `name`, `description`, `status`, `delete_flg`, `created_at`, `updated_at`) VALUES
  ('businessExpenses.view', 'View Business Expenses', 'Access expense records, categories, summaries, and recurring schedules', 1, 0, NOW(), NOW()),
  ('businessExpenses.create', 'Create Business Expenses', 'Record manual expenses and create recurring expense schedules', 1, 0, NOW(), NOW()),
  ('businessExpenses.update', 'Update Business Expenses', 'Edit business expenses and recurring expense schedules', 1, 0, NOW(), NOW()),
  ('businessExpenses.delete', 'Delete Business Expenses', 'Remove business expenses and recurring expense schedules', 1, 0, NOW(), NOW())
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`),
  `status` = VALUES(`status`),
  `delete_flg` = VALUES(`delete_flg`),
  `updated_at` = NOW();

INSERT INTO `role_permissions` (`role`, `permission_id`)
SELECT 'admin', `id`
FROM `permissions`
WHERE `slug` IN ('businessExpenses.view', 'businessExpenses.create', 'businessExpenses.update', 'businessExpenses.delete')
ON DUPLICATE KEY UPDATE
  `permission_id` = VALUES(`permission_id`);

INSERT INTO `expense_categories` (`id`, `parent_id`, `name`, `description`, `sort_order`, `status`, `delete_flg`, `created_at`, `updated_at`) VALUES
  (1, NULL, 'Facility & Storage', 'Costs related to storefront, warehouse, and physical business space.', 10, 1, 0, NOW(), NOW()),
  (2, NULL, 'Logistics & Distribution', 'Costs of moving inventory and completing deliveries.', 20, 1, 0, NOW(), NOW()),
  (3, NULL, 'Personnel & Labor', 'Salary, payroll, and workforce-related operating costs.', 30, 1, 0, NOW(), NOW()),
  (4, NULL, 'Financial Charges', 'Bank charges, financing costs, and other non-operational fees.', 40, 1, 0, NOW(), NOW()),
  (5, NULL, 'Sales & Marketing', 'Advertising and commercial growth spending.', 50, 1, 0, NOW(), NOW()),
  (6, NULL, 'Administrative & General', 'Day-to-day office and overhead spending.', 60, 1, 0, NOW(), NOW()),
  (7, NULL, 'Non-Cash Adjustments', 'Accounting-only costs such as depreciation.', 70, 1, 0, NOW(), NOW()),
  (11, 1, 'Warehouse Rent', 'Monthly storage or warehouse lease payments.', 11, 1, 0, NOW(), NOW()),
  (12, 1, 'Store Rent', 'Retail storefront lease payments.', 12, 1, 0, NOW(), NOW()),
  (13, 1, 'Electricity & Utilities', 'Electricity, water, and utility bills.', 13, 1, 0, NOW(), NOW()),
  (21, 2, 'Fuel & Oil', 'Gasoline, diesel, and lubricants for vehicles.', 21, 1, 0, NOW(), NOW()),
  (22, 2, 'Vehicle Maintenance', 'Repairs, tires, and scheduled servicing.', 22, 1, 0, NOW(), NOW()),
  (23, 2, 'Travel Accommodation', 'Lodging for out-of-town trips.', 23, 1, 0, NOW(), NOW()),
  (24, 2, 'Meals & Per Diem', 'Travel allowances for drivers and helpers.', 24, 1, 0, NOW(), NOW()),
  (25, 2, 'Route Fees', 'Tolls, ferries, and other route-based charges.', 25, 1, 0, NOW(), NOW()),
  (31, 3, 'Logistics Salaries', 'Compensation for drivers and loaders.', 31, 1, 0, NOW(), NOW()),
  (32, 3, 'Sales Salaries', 'Compensation for sales staff.', 32, 1, 0, NOW(), NOW()),
  (33, 3, 'Administrative Salaries', 'Compensation for office and support staff.', 33, 1, 0, NOW(), NOW()),
  (34, 3, 'Commissions', 'Performance-based sales payouts.', 34, 1, 0, NOW(), NOW()),
  (41, 4, 'Truck Interest Expense', 'Interest cost on truck financing.', 41, 1, 0, NOW(), NOW()),
  (42, 4, 'Bank Service Fees', 'Banking and transfer charges.', 42, 1, 0, NOW(), NOW()),
  (51, 5, 'Advertising', 'Digital and offline advertising spend.', 51, 1, 0, NOW(), NOW()),
  (52, 5, 'Signage & Displays', 'Physical branding and in-store marketing materials.', 52, 1, 0, NOW(), NOW()),
  (61, 6, 'Office Supplies', 'Stationery and office consumables.', 61, 1, 0, NOW(), NOW()),
  (62, 6, 'Insurance', 'Business insurance premiums.', 62, 1, 0, NOW(), NOW()),
  (63, 6, 'Permits & Licenses', 'Government permits, renewals, and compliance fees.', 63, 1, 0, NOW(), NOW()),
  (64, 6, 'IT Maintenance & Support', 'Hosting, software, and technical support fees.', 64, 1, 0, NOW(), NOW()),
  (71, 7, 'Truck Depreciation', 'Non-cash depreciation of delivery vehicles.', 71, 1, 0, NOW(), NOW()),
  (72, 7, 'Equipment Depreciation', 'Non-cash depreciation of tools and office equipment.', 72, 1, 0, NOW(), NOW())
ON DUPLICATE KEY UPDATE
  `parent_id` = VALUES(`parent_id`),
  `description` = VALUES(`description`),
  `sort_order` = VALUES(`sort_order`),
  `status` = VALUES(`status`),
  `delete_flg` = VALUES(`delete_flg`),
  `updated_at` = NOW();
