USE `jrspc_node`;

-- Inventory adjustments (header + items) with workflow status.

CREATE TABLE IF NOT EXISTS `inventory_adjustments` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `adjustment_number` VARCHAR(50) NOT NULL,
  `adjustment_date` DATETIME NOT NULL,
  `remarks` TEXT DEFAULT NULL,
  `reason` VARCHAR(255) DEFAULT NULL,
  `created_by` BIGINT UNSIGNED DEFAULT NULL,
  `status` ENUM('draft','pending','approved','rejected') NOT NULL DEFAULT 'draft',
  `reject_reason` VARCHAR(255) DEFAULT NULL,
  `delete_flg` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) DEFAULT NULL,
  `updated_ip` VARCHAR(45) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_inventory_adjustments_adjustment_number` (`adjustment_number`),
  KEY `idx_inventory_adjustments_adjustment_date` (`adjustment_date`),
  KEY `idx_inventory_adjustments_status` (`status`),
  KEY `idx_inventory_adjustments_delete_flg` (`delete_flg`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `inventory_adjustment_items` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `inventory_adjustment_id` BIGINT UNSIGNED NOT NULL,
  `product_id` BIGINT UNSIGNED NOT NULL,
  `product_variant_id` BIGINT UNSIGNED NOT NULL,
  `adjust_type` ENUM('add','subtract') NOT NULL,
  `quantity_change` INT NOT NULL,
  `quantity_before` INT NOT NULL DEFAULT 0,
  `quantity_after` INT NOT NULL DEFAULT 0,
  `notes` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) DEFAULT NULL,
  `updated_ip` VARCHAR(45) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_inventory_adjustment_items_adjustment_id` (`inventory_adjustment_id`),
  KEY `idx_inventory_adjustment_items_product_id` (`product_id`),
  KEY `idx_inventory_adjustment_items_variant_id` (`product_variant_id`),
  CONSTRAINT `fk_inventory_adjustment_items_adjustment_id` FOREIGN KEY (`inventory_adjustment_id`) REFERENCES `inventory_adjustments`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_inventory_adjustment_items_product_id` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_inventory_adjustment_items_variant_id` FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Permissions (legacy-style slugs for compatibility with existing UI wording)
INSERT INTO `permissions` (`slug`, `name`, `description`, `status`, `delete_flg`, `created_at`, `updated_at`) VALUES
  ('view_stock_adjustments', 'View Stock Adjustments', 'Allow users to view stock adjustment records', 1, 0, NOW(), NOW()),
  ('create_stock_adjustments', 'Create Stock Adjustments', 'Allow users to create stock adjustments', 1, 0, NOW(), NOW()),
  ('edit_stock_adjustments', 'Edit Stock Adjustments', 'Allow users to edit draft stock adjustments', 1, 0, NOW(), NOW()),
  ('approve_stock_adjustments', 'Approve Stock Adjustments', 'Allow users to approve or reject stock adjustments', 1, 0, NOW(), NOW()),
  ('delete_stock_adjustments', 'Delete Stock Adjustments', 'Allow users to delete stock adjustments', 1, 0, NOW(), NOW()),
  ('export_stock_adjustments', 'Export Stock Adjustments', 'Allow users to export stock adjustments', 1, 0, NOW(), NOW())
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`),
  `status` = VALUES(`status`),
  `delete_flg` = VALUES(`delete_flg`),
  `updated_at` = NOW();

INSERT INTO `role_permissions` (`role`, `permission_id`)
SELECT 'admin', `id`
FROM `permissions`
WHERE `slug` IN (
  'view_stock_adjustments',
  'create_stock_adjustments',
  'edit_stock_adjustments',
  'approve_stock_adjustments',
  'delete_stock_adjustments',
  'export_stock_adjustments'
)
ON DUPLICATE KEY UPDATE `permission_id` = VALUES(`permission_id`);

