USE `jrspc_node`;

CREATE TABLE IF NOT EXISTS `products` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `category_id` INT NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `file_url` VARCHAR(255) NULL,
  `status` TINYINT(1) NOT NULL DEFAULT 1,
  `delete_flg` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) NULL,
  `updated_ip` VARCHAR(45) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_products_category_id` (`category_id`),
  KEY `idx_products_status` (`status`),
  KEY `idx_products_delete_flg` (`delete_flg`),
  CONSTRAINT `fk_products_category_id`
    FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `product_variants` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `product_id` BIGINT UNSIGNED NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `variant_type` VARCHAR(100) NULL,
  `length_value` DECIMAL(10,2) NULL,
  `length_unit` VARCHAR(30) NULL,
  `unit_cost` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `unit_price` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `stock_quantity` INT NOT NULL DEFAULT 0,
  `reorder_level` INT NOT NULL DEFAULT 0,
  `status` TINYINT(1) NOT NULL DEFAULT 1,
  `delete_flg` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) NULL,
  `updated_ip` VARCHAR(45) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_product_variants_product_id` (`product_id`),
  KEY `idx_product_variants_status` (`status`),
  KEY `idx_product_variants_delete_flg` (`delete_flg`),
  CONSTRAINT `fk_product_variants_product_id`
    FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `permissions` (`slug`, `name`, `description`) VALUES
  ('products.view', 'View Products', 'Allow users to view product families and variants'),
  ('products.create', 'Create Products', 'Allow users to create product families and variants'),
  ('products.update', 'Update Products', 'Allow users to update product families and variants'),
  ('products.delete', 'Delete Products', 'Allow users to soft delete product families and variants')
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`);
