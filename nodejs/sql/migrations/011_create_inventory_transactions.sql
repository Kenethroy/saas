USE `jrspc_node`;

CREATE TABLE IF NOT EXISTS `inventory_transactions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `product_id` BIGINT UNSIGNED NOT NULL,
  `product_variant_id` BIGINT UNSIGNED NOT NULL,
  `quantity_before` INT NOT NULL DEFAULT 0 COMMENT 'Stock quantity before transaction',
  `quantity_change` INT NOT NULL COMMENT 'Change amount (positive for increase, negative for decrease)',
  `quantity_after` INT NOT NULL DEFAULT 0 COMMENT 'Stock quantity after transaction',
  `transaction_type` TINYINT NOT NULL COMMENT '1=purchase, 2=sale, 3=adjustment, 4=return',
  `reference_type` VARCHAR(50) DEFAULT NULL COMMENT 'Source document type (e.g., sales_order_delivered, purchase_order, adjustment)',
  `reference_id` BIGINT UNSIGNED DEFAULT NULL COMMENT 'Source document ID',
  `reason` TEXT DEFAULT NULL COMMENT 'Description or reason for the transaction',
  `created_by` BIGINT UNSIGNED DEFAULT NULL COMMENT 'User ID who created this transaction',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) DEFAULT NULL,
  `updated_ip` VARCHAR(45) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_inventory_transactions_product_id` (`product_id`),
  KEY `idx_inventory_transactions_product_variant_id` (`product_variant_id`),
  KEY `idx_inventory_transactions_reference_type` (`reference_type`),
  KEY `idx_inventory_transactions_reference_id` (`reference_id`),
  CONSTRAINT `fk_inventory_transactions_product_id` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_inventory_transactions_product_variant_id` FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

