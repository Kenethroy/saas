-- Migration: 016_create_customer_returns.sql
-- Create customer_returns and customer_return_items tables

USE `jrspc_node`;

CREATE TABLE IF NOT EXISTS `customer_returns` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `rma_number` VARCHAR(50) NOT NULL,
  `customer_id` BIGINT UNSIGNED NOT NULL,
  `invoice_id` BIGINT UNSIGNED DEFAULT NULL,
  `request_date` DATE NOT NULL,
  `reason` VARCHAR(100) NOT NULL,
  `disposition` VARCHAR(100) NOT NULL,
  `status` ENUM('draft', 'pending', 'approved', 'completed', 'rejected') NOT NULL DEFAULT 'draft',
  `total_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `notes` TEXT DEFAULT NULL,
  `delete_flg` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) DEFAULT NULL,
  `updated_ip` VARCHAR(45) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_customer_returns_rma_number` (`rma_number`),
  KEY `idx_customer_returns_customer_id` (`customer_id`),
  KEY `idx_customer_returns_invoice_id` (`invoice_id`),
  KEY `idx_customer_returns_status` (`status`),
  KEY `idx_customer_returns_delete_flg` (`delete_flg`),
  CONSTRAINT `fk_customer_returns_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_customer_returns_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `customer_return_items` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `customer_return_id` BIGINT UNSIGNED NOT NULL,
  `product_id` BIGINT UNSIGNED NOT NULL,
  `product_variant_id` BIGINT UNSIGNED NOT NULL,
  `product_name` VARCHAR(255) NOT NULL,
  `variant_name` VARCHAR(255) NOT NULL,
  `quantity` INT NOT NULL,
  `unit_price` DECIMAL(15, 2) NOT NULL,
  `line_total` DECIMAL(15, 2) NOT NULL,
  `restock_flg` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_customer_return_items_return_id` (`customer_return_id`),
  KEY `idx_customer_return_items_product_id` (`product_id`),
  KEY `idx_customer_return_items_variant_id` (`product_variant_id`),
  CONSTRAINT `fk_customer_return_items_return` FOREIGN KEY (`customer_return_id`) REFERENCES `customer_returns` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_customer_return_items_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_customer_return_items_variant` FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Permissions and Role Assignments
INSERT INTO `permissions` (`slug`, `name`, `description`, `status`, `delete_flg`, `created_at`, `updated_at`) VALUES
  ('customerReturns.view', 'View Customer Returns', 'Allow users to view customer return records', 1, 0, NOW(), NOW()),
  ('customerReturns.create', 'Create Customer Returns', 'Allow users to record new customer returns', 1, 0, NOW(), NOW()),
  ('customerReturns.update', 'Update Customer Returns', 'Allow users to update customer return details', 1, 0, NOW(), NOW()),
  ('customerReturns.approve', 'Approve/Reject Customer Returns', 'Allow users to approve or reject customer returns', 1, 0, NOW(), NOW()),
  ('customerReturns.delete', 'Delete Customer Returns', 'Allow users to archive customer return records', 1, 0, NOW(), NOW())
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`),
  `status` = VALUES(`status`),
  `delete_flg` = VALUES(`delete_flg`),
  `updated_at` = NOW();

-- Assign all returns permissions to admin role
INSERT INTO `role_permissions` (`role`, `permission_id`)
SELECT 'admin', `id`
FROM `permissions`
WHERE `slug` LIKE 'customerReturns.%'
ON DUPLICATE KEY UPDATE `permission_id` = VALUES(`permission_id`);
