-- Combined fresh SQL for jrspc_nodeapi
-- Merged from sql/migrations/*.sql (ALTERs already applied into CREATEs)
-- Includes 017_add_accounts_receivable_agent_id.sql and 020_add_inventory_adjustment_restock_flag.sql folded into respective CREATE TABLEs
-- Includes 022_create_suppliers.sql and 023_create_purchase_orders.sql

CREATE DATABASE IF NOT EXISTS `jrspc_node`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `jrspc_node`;

-- categories
CREATE TABLE IF NOT EXISTS `categories` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `status` TINYINT(1) NOT NULL DEFAULT 1,
  `delete_flg` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) NULL,
  `updated_ip` VARCHAR(45) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_categories_name` (`name`),
  KEY `idx_categories_status` (`status`),
  KEY `idx_categories_delete_flg` (`delete_flg`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- products and variants
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

-- trucks
CREATE TABLE IF NOT EXISTS `trucks` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `plate_number` VARCHAR(50) NOT NULL,
  `model` VARCHAR(100) NULL,
  `brand` VARCHAR(100) NULL,
  `year` INT NULL,
  `color` VARCHAR(50) NULL,
  `capacity_kg` DECIMAL(10,2) NULL,
  `status` ENUM('active', 'inactive', 'maintenance') NOT NULL DEFAULT 'active',
  `notes` TEXT NULL,
  `delete_flg` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) NULL,
  `updated_ip` VARCHAR(45) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_trucks_plate_number` (`plate_number`),
  KEY `idx_trucks_status` (`status`),
  KEY `idx_trucks_delete_flg` (`delete_flg`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- payment_terms
CREATE TABLE IF NOT EXISTS `payment_terms` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `days` INT NOT NULL DEFAULT 0,
  `status` TINYINT(1) NOT NULL DEFAULT 1,
  `delete_flg` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) NULL,
  `updated_ip` VARCHAR(45) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_payment_terms_name` (`name`),
  KEY `idx_payment_terms_status` (`status`),
  KEY `idx_payment_terms_delete_flg` (`delete_flg`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- customers (depends on payment_terms)
CREATE TABLE IF NOT EXISTS `customers` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NULL,
  `phone` VARCHAR(50) NULL,
  `company` VARCHAR(255) NULL,
  `address` TEXT NULL,
  `payment_term_id` INT NULL,
  `status` TINYINT(1) NOT NULL DEFAULT 1,
  `delete_flg` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) NULL,
  `updated_ip` VARCHAR(45) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_customers_email` (`email`),
  KEY `idx_customers_payment_term_id` (`payment_term_id`),
  KEY `idx_customers_status` (`status`),
  KEY `idx_customers_delete_flg` (`delete_flg`),
  CONSTRAINT `fk_customers_payment_term_id`
    FOREIGN KEY (`payment_term_id`) REFERENCES `payment_terms` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- suppliers (depends on payment_terms)
CREATE TABLE IF NOT EXISTS `suppliers` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `company_name` VARCHAR(255) NULL,
  `contact_person` VARCHAR(255) NULL,
  `email` VARCHAR(255) NULL,
  `phone` VARCHAR(50) NULL,
  `address` TEXT NULL,
  `payment_term_id` INT NULL,
  `status` TINYINT(1) NOT NULL DEFAULT 1,
  `delete_flg` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) NULL,
  `updated_ip` VARCHAR(45) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_suppliers_name` (`name`),
  KEY `idx_suppliers_payment_term_id` (`payment_term_id`),
  KEY `idx_suppliers_status` (`status`),
  KEY `idx_suppliers_delete_flg` (`delete_flg`),
  CONSTRAINT `fk_suppliers_payment_term_id`
    FOREIGN KEY (`payment_term_id`) REFERENCES `payment_terms` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- employees (no user_id column; relationship will be on users.employee_id)
CREATE TABLE IF NOT EXISTS `employees` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `first_name` VARCHAR(100) NOT NULL,
  `last_name` VARCHAR(100) NOT NULL,
  `position` VARCHAR(50) NOT NULL COMMENT 'agent, driver, pahinante, staff',
  `phone` VARCHAR(20) NULL,
  `email` VARCHAR(100) NULL,
  `status` ENUM('active', 'inactive', 'on_leave') NOT NULL DEFAULT 'active',
  `address` TEXT NULL,
  `license_number` VARCHAR(50) NULL,
  `license_expiry` DATE NULL,
  `emergency_contact_name` VARCHAR(100) NULL,
  `emergency_contact_phone` VARCHAR(20) NULL,
  `date_hired` DATE NULL,
  `salary_rate` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `rate_type` ENUM('Monthly', 'Daily', 'Per Trip') NOT NULL DEFAULT 'Daily',
  `sss_no` VARCHAR(20) NULL,
  `tin_no` VARCHAR(20) NULL,
  `philhealth_no` VARCHAR(20) NULL,
  `pagibig_no` VARCHAR(20) NULL,
  `delete_flg` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) NULL,
  `updated_ip` VARCHAR(45) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_employees_email` (`email`),
  KEY `idx_employees_status` (`status`),
  KEY `idx_employees_delete_flg` (`delete_flg`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- users (merged: include employee_id referencing employees)
CREATE TABLE IF NOT EXISTS `users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `employee_id` BIGINT UNSIGNED NULL,
  `username` VARCHAR(100) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('admin', 'staff', 'agent', 'driver') NOT NULL DEFAULT 'staff',
  `status` TINYINT(1) NOT NULL DEFAULT 1,
  `delete_flg` TINYINT(1) NOT NULL DEFAULT 0,
  `last_login_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) NULL,
  `updated_ip` VARCHAR(45) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_username` (`username`),
  UNIQUE KEY `uq_users_email` (`email`),
  UNIQUE KEY `uq_users_employee_id` (`employee_id`),
  KEY `idx_users_role` (`role`),
  KEY `idx_users_status` (`status`),
  KEY `idx_users_delete_flg` (`delete_flg`),
  CONSTRAINT `fk_users_employee_id`
    FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- user_sessions
CREATE TABLE IF NOT EXISTS `user_sessions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `token` VARCHAR(512) NOT NULL,
  `token_hash` CHAR(64) NULL,
  `device_id` VARCHAR(128) NULL,
  `device_name` VARCHAR(128) NULL,
  `platform` VARCHAR(64) NULL,
  `user_agent` VARCHAR(255) NULL,
  `ip_address` VARCHAR(45) NULL,
  `last_seen_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` DATETIME NULL,
  `revoked_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_sessions_token` (`token`),
  UNIQUE KEY `uq_user_sessions_token_hash` (`token_hash`),
  KEY `idx_user_sessions_user_id` (`user_id`),
  KEY `idx_user_sessions_device_id` (`device_id`),
  KEY `idx_user_sessions_active` (`user_id`, `revoked_at`, `expires_at`),
  CONSTRAINT `fk_user_sessions_user_id`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- permissions, role_permissions, user_permissions
CREATE TABLE IF NOT EXISTS `permissions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `slug` VARCHAR(100) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `status` TINYINT(1) NOT NULL DEFAULT 1,
  `delete_flg` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) NULL,
  `updated_ip` VARCHAR(45) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_permissions_slug` (`slug`),
  KEY `idx_permissions_status` (`status`),
  KEY `idx_permissions_delete_flg` (`delete_flg`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `role_permissions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `role` ENUM('admin', 'staff', 'agent', 'driver') NOT NULL,
  `permission_id` INT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) NULL,
  `updated_ip` VARCHAR(45) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_role_permissions_role_permission_id` (`role`, `permission_id`),
  KEY `idx_role_permissions_role` (`role`),
  KEY `idx_role_permissions_permission_id` (`permission_id`),
  CONSTRAINT `fk_role_permissions_permission_id`
    FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_permissions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `permission_id` INT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) NULL,
  `updated_ip` VARCHAR(45) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_permissions_user_permission_id` (`user_id`, `permission_id`),
  KEY `idx_user_permissions_user_id` (`user_id`),
  KEY `idx_user_permissions_permission_id` (`permission_id`),
  CONSTRAINT `fk_user_permissions_user_id`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_user_permissions_permission_id`
    FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- payment_terms seed
INSERT INTO `payment_terms` (`name`, `days`) VALUES
  ('Cash on Delivery', 0),
  ('Due on Receipt', 0),
  ('Net 15 Days', 15),
  ('Net 30 Days', 30),
  ('Net 60 Days', 60)
ON DUPLICATE KEY UPDATE
  `days` = VALUES(`days`);

-- payment_terms permissions
INSERT INTO `permissions` (`slug`, `name`, `description`) VALUES
  ('paymentTerms.view', 'View Payment Terms', 'Allow users to view payment terms'),
  ('paymentTerms.create', 'Create Payment Terms', 'Allow users to create payment terms'),
  ('paymentTerms.update', 'Update Payment Terms', 'Allow users to update payment terms'),
  ('paymentTerms.delete', 'Delete Payment Terms', 'Allow users to delete payment terms')
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`);

-- products/variants permissions
INSERT INTO `permissions` (`slug`, `name`, `description`) VALUES
  ('products.view', 'View Products', 'Allow users to view product families and variants'),
  ('products.create', 'Create Products', 'Allow users to create product families and variants'),
  ('products.update', 'Update Products', 'Allow users to update product families and variants'),
  ('products.delete', 'Delete Products', 'Allow users to soft delete product families and variants')
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`);

-- trucks permissions
INSERT INTO `permissions` (`slug`, `name`, `description`) VALUES
  ('trucks.view', 'View Trucks', 'Allow users to view trucks'),
  ('trucks.create', 'Create Trucks', 'Allow users to create trucks'),
  ('trucks.update', 'Update Trucks', 'Allow users to update trucks'),
  ('trucks.delete', 'Delete Trucks', 'Allow users to delete trucks')
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`);

-- categories permissions
INSERT INTO `permissions` (`slug`, `name`, `description`) VALUES
  ('categories.view', 'View Categories', 'Allow users to view categories'),
  ('categories.create', 'Create Categories', 'Allow users to create categories'),
  ('categories.update', 'Update Categories', 'Allow users to update categories'),
  ('categories.delete', 'Delete Categories', 'Allow users to delete categories')
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`);

-- core identity permissions (users, employees)
INSERT INTO `permissions` (`slug`, `name`, `description`) VALUES
  ('employees.view', 'View Employees', 'Allow users to view employee records'),
  ('employees.create', 'Create Employees', 'Allow users to create employee records'),
  ('employees.update', 'Update Employees', 'Allow users to update employee records'),
  ('employees.delete', 'Delete Employees', 'Allow users to archive employee records'),
  ('users.view', 'View Users', 'Allow users to view system users'),
  ('users.create', 'Create Users', 'Allow users to create system users'),
  ('users.update', 'Update Users', 'Allow users to update system users'),
  ('users.permissions.manage', 'Manage User Permissions', 'Allow users to manage roles and permissions'),
  ('users.delete', 'Delete Users', 'Allow users to remove user access')
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`);

-- customer_returns permissions (from 016_create_customer_returns.sql)
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

-- Assign all permissions to admin role (mirrors migration behavior)
INSERT INTO `role_permissions` (`role`, `permission_id`)
SELECT 'admin', `id`
FROM `permissions`
ON DUPLICATE KEY UPDATE `permission_id` = VALUES(`permission_id`);

-- sales_orders and items
CREATE TABLE IF NOT EXISTS `sales_orders` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `sales_order_number` VARCHAR(50) NOT NULL,
  `customer_id` BIGINT UNSIGNED NOT NULL,
  `order_date` DATE NOT NULL,
  `agent_id` BIGINT UNSIGNED DEFAULT NULL,
  `payment_term_id` INT DEFAULT NULL,
  `status` ENUM('pending','processing','for_delivery','delivered','completed','cancelled') NOT NULL DEFAULT 'pending',
  `items_subtotal` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `discount_type` ENUM('none','percentage','fixed') NOT NULL DEFAULT 'none',
  `discount_value` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `discount_amount` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `total_amount` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `notes` TEXT DEFAULT NULL,
  `delete_flg` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) DEFAULT NULL,
  `updated_ip` VARCHAR(45) DEFAULT NULL,
  CONSTRAINT `uq_sales_orders_number` UNIQUE (`sales_order_number`),
  INDEX `idx_sales_orders_customer_id` (`customer_id`),
  INDEX `idx_sales_orders_agent_id` (`agent_id`),
  INDEX `idx_sales_orders_payment_term_id` (`payment_term_id`),
  INDEX `idx_sales_orders_status` (`status`),
  INDEX `idx_sales_orders_delete_flg` (`delete_flg`),
  CONSTRAINT `fk_sales_orders_customer_id` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`),
  CONSTRAINT `fk_sales_orders_agent_id` FOREIGN KEY (`agent_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_sales_orders_payment_term_id` FOREIGN KEY (`payment_term_id`) REFERENCES `payment_terms`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sales_order_items` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `sales_order_id` BIGINT UNSIGNED NOT NULL,
  `product_id` BIGINT UNSIGNED NOT NULL,
  `product_variant_id` BIGINT UNSIGNED NOT NULL,
  `product_name` VARCHAR(255) NOT NULL,
  `variant_name` VARCHAR(255) NOT NULL,
  `quantity` INT NOT NULL,
  `unit_price` DECIMAL(15,2) NOT NULL,
  `unit_cost` DECIMAL(15,2) NOT NULL,
  `line_discount` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `line_total` DECIMAL(15,2) NOT NULL,
  `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_sales_order_items_sales_order_id` (`sales_order_id`),
  INDEX `idx_sales_order_items_product_id` (`product_id`),
  INDEX `idx_sales_order_items_product_variant_id` (`product_variant_id`),
  CONSTRAINT `fk_sales_order_items_sales_order_id` FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sales_order_items_product_id` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`),
  CONSTRAINT `fk_sales_order_items_product_variant_id` FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- purchase_orders and items (depends on suppliers, products, payment_terms)
CREATE TABLE IF NOT EXISTS `purchase_orders` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `po_number` VARCHAR(50) NOT NULL,
  `supplier_id` BIGINT UNSIGNED NOT NULL,
  `order_date` DATE NOT NULL,
  `expected_date` DATE DEFAULT NULL,
  `payment_term_id` INT DEFAULT NULL,
  `status` ENUM('pending','approved','received','cancelled') NOT NULL DEFAULT 'pending',
  `items_subtotal` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `discount_type` ENUM('none','percentage','fixed') NOT NULL DEFAULT 'none',
  `discount_value` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `discount_amount` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `total_amount` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `received_total` DECIMAL(15,2) NULL DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `received_notes` TEXT DEFAULT NULL,
  `delete_flg` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `received_at` DATETIME NULL DEFAULT NULL,
  `updated_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) DEFAULT NULL,
  `updated_ip` VARCHAR(45) DEFAULT NULL,
  CONSTRAINT `uq_purchase_orders_number` UNIQUE (`po_number`),
  INDEX `idx_purchase_orders_supplier_id` (`supplier_id`),
  INDEX `idx_purchase_orders_payment_term_id` (`payment_term_id`),
  INDEX `idx_purchase_orders_status` (`status`),
  INDEX `idx_purchase_orders_delete_flg` (`delete_flg`),
  CONSTRAINT `fk_purchase_orders_supplier_id` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`),
  CONSTRAINT `fk_purchase_orders_payment_term_id` FOREIGN KEY (`payment_term_id`) REFERENCES `payment_terms`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `purchase_order_items` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `purchase_order_id` BIGINT UNSIGNED NOT NULL,
  `product_id` BIGINT UNSIGNED NOT NULL,
  `product_variant_id` BIGINT UNSIGNED NOT NULL,
  `product_name` VARCHAR(255) NOT NULL,
  `variant_name` VARCHAR(255) NOT NULL,
  `quantity` INT NOT NULL,
  `received_quantity` INT NULL DEFAULT NULL,
  `unit_cost` DECIMAL(15,2) NOT NULL,
  `received_unit_cost` DECIMAL(15,2) NULL DEFAULT NULL,
  `line_discount` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `line_total` DECIMAL(15,2) NOT NULL,
  `received_line_total` DECIMAL(15,2) NULL DEFAULT NULL,
  `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_purchase_order_items_po_id` (`purchase_order_id`),
  INDEX `idx_purchase_order_items_product_id` (`product_id`),
  INDEX `idx_purchase_order_items_product_variant_id` (`product_variant_id`),
  CONSTRAINT `fk_purchase_order_items_po_id` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_purchase_order_items_product_id` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`),
  CONSTRAINT `fk_purchase_order_items_product_variant_id` FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- inventory_transactions
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

-- invoices and items
CREATE TABLE IF NOT EXISTS `invoices` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `invoice_number` VARCHAR(50) NOT NULL,
  `sales_order_id` BIGINT UNSIGNED DEFAULT NULL,
  `customer_id` BIGINT UNSIGNED NOT NULL,
  `agent_id` BIGINT UNSIGNED DEFAULT NULL,
  `payment_term_id` INT DEFAULT NULL,
  `invoice_date` DATE NOT NULL,
  `due_date` DATE DEFAULT NULL,
  `gross_amount` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `item_discount_total` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `subtotal` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `discount_type` ENUM('none','percentage','fixed') NOT NULL DEFAULT 'none',
  `discount_value` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `order_discount` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `net_of_discounts` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `vatable_sales` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `vat_amount` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `grand_total` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `paid_amount` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `balance_due` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `status` ENUM('draft','issued','partial','paid','cancelled') NOT NULL DEFAULT 'draft',
  `remarks` VARCHAR(255) DEFAULT NULL,
  `delete_flg` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) DEFAULT NULL,
  `updated_ip` VARCHAR(45) DEFAULT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `uq_invoices_invoice_number` UNIQUE (`invoice_number`),
  CONSTRAINT `uq_invoices_sales_order_id` UNIQUE (`sales_order_id`),
  INDEX `idx_invoices_customer_id` (`customer_id`),
  INDEX `idx_invoices_agent_id` (`agent_id`),
  INDEX `idx_invoices_payment_term_id` (`payment_term_id`),
  INDEX `idx_invoices_status` (`status`),
  INDEX `idx_invoices_delete_flg` (`delete_flg`),
  CONSTRAINT `fk_invoices_sales_order_id` FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders`(`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_invoices_customer_id` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`),
  CONSTRAINT `fk_invoices_agent_id` FOREIGN KEY (`agent_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_invoices_payment_term_id` FOREIGN KEY (`payment_term_id`) REFERENCES `payment_terms`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `invoice_items` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `invoice_id` BIGINT UNSIGNED NOT NULL,
  `product_id` BIGINT UNSIGNED NOT NULL,
  `product_variant_id` BIGINT UNSIGNED NOT NULL,
  `product_name` VARCHAR(255) NOT NULL,
  `variant_name` VARCHAR(255) NOT NULL,
  `quantity` INT NOT NULL,
  `unit_price` DECIMAL(15,2) NOT NULL,
  `unit_cost` DECIMAL(15,2) NOT NULL,
  `line_discount` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `line_total` DECIMAL(15,2) NOT NULL,
  `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_invoice_items_invoice_id` (`invoice_id`),
  INDEX `idx_invoice_items_product_id` (`product_id`),
  INDEX `idx_invoice_items_product_variant_id` (`product_variant_id`),
  CONSTRAINT `fk_invoice_items_invoice_id` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_invoice_items_product_id` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`),
  CONSTRAINT `fk_invoice_items_product_variant_id` FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- accounts_receivable (includes 017_add_accounts_receivable_agent_id.sql)
CREATE TABLE IF NOT EXISTS `accounts_receivable` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `invoice_id` BIGINT UNSIGNED DEFAULT NULL,
  `customer_id` BIGINT UNSIGNED NOT NULL,
  `agent_id` BIGINT UNSIGNED DEFAULT NULL,
  `invoice_date` DATE NOT NULL,
  `due_date` DATE DEFAULT NULL,
  `amount` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `paid_amount` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `outstanding_amount` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `is_opening_balance` TINYINT(1) NOT NULL DEFAULT 0,
  `status` ENUM('unpaid','partial','paid') NOT NULL DEFAULT 'unpaid',
  `delete_flg` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) DEFAULT NULL,
  `updated_ip` VARCHAR(45) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_accounts_receivable_invoice_id` (`invoice_id`),
  KEY `idx_accounts_receivable_customer_id` (`customer_id`),
  KEY `idx_accounts_receivable_agent_id` (`agent_id`),
  KEY `idx_accounts_receivable_status` (`status`),
  KEY `idx_accounts_receivable_delete_flg` (`delete_flg`),
  CONSTRAINT `fk_accounts_receivable_invoice_id` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_accounts_receivable_customer_id` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`),
  CONSTRAINT `fk_accounts_receivable_agent_id` FOREIGN KEY (`agent_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- accounts_payable (auto-created when a Purchase Order is received)
CREATE TABLE IF NOT EXISTS `accounts_payable` (
  `id`                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `purchase_order_id`  BIGINT UNSIGNED NOT NULL,
  `supplier_id`        BIGINT UNSIGNED NOT NULL,
  `po_number`          VARCHAR(50)     NOT NULL,
  `receipt_date`       DATE            NOT NULL,
  `due_date`           DATE            DEFAULT NULL,
  `amount`             DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
  `paid_amount`        DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
  `outstanding_amount` DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
  `status`             ENUM('unpaid','partial','paid') NOT NULL DEFAULT 'unpaid',
  `notes`              TEXT            DEFAULT NULL,
  `delete_flg`         TINYINT(1)      NOT NULL DEFAULT 0,
  `created_at`         DATETIME        NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`         DATETIME        NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip`         VARCHAR(45)     DEFAULT NULL,
  `updated_ip`         VARCHAR(45)     DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_accounts_payable_po_id` (`purchase_order_id`),
  KEY `idx_accounts_payable_supplier_id` (`supplier_id`),
  KEY `idx_accounts_payable_status` (`status`),
  KEY `idx_accounts_payable_due_date` (`due_date`),
  KEY `idx_accounts_payable_delete_flg` (`delete_flg`),
  CONSTRAINT `fk_accounts_payable_po_id`       FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`),
  CONSTRAINT `fk_accounts_payable_supplier_id` FOREIGN KEY (`supplier_id`)       REFERENCES `suppliers`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- payments and allocations
CREATE TABLE IF NOT EXISTS `payments` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `payment_number` VARCHAR(50) NOT NULL,
  `customer_id` BIGINT UNSIGNED NOT NULL,
  `payment_date` DATE NOT NULL,
  `payment_method` ENUM('cash', 'cheque', 'bank_transfer', 'credit_card', 'other') NOT NULL DEFAULT 'cash',
  `amount` DECIMAL(15,2) NOT NULL,
  `reference_number` VARCHAR(100) DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `file_url` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) DEFAULT NULL,
  `updated_ip` VARCHAR(45) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_payments_payment_number` (`payment_number`),
  KEY `idx_payments_customer_id` (`customer_id`),
  KEY `idx_payments_payment_date` (`payment_date`),
  CONSTRAINT `fk_payments_customer_id`
    FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `payment_allocations` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `payment_id` BIGINT UNSIGNED NOT NULL,
  `accounts_receivable_id` BIGINT UNSIGNED NOT NULL,
  `amount_allocated` DECIMAL(15,2) NOT NULL,
  `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) DEFAULT NULL,
  `updated_ip` VARCHAR(45) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_payment_allocations_payment_ar` (`payment_id`, `accounts_receivable_id`),
  KEY `idx_payment_allocations_payment_id` (`payment_id`),
  KEY `idx_payment_allocations_accounts_receivable_id` (`accounts_receivable_id`),
  CONSTRAINT `fk_payment_allocations_payment_id`
    FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_payment_allocations_accounts_receivable_id`
    FOREIGN KEY (`accounts_receivable_id`) REFERENCES `accounts_receivable`(`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- quotations and items
CREATE TABLE IF NOT EXISTS `quotations` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `quote_number` VARCHAR(50) NOT NULL,
  `customer_id` BIGINT UNSIGNED NOT NULL,
  `contact_person` VARCHAR(255) DEFAULT NULL,
  `quote_date` DATE NOT NULL,
  `valid_until` DATE NOT NULL,
  `payment_term_id` INT DEFAULT NULL,
  `agent_id` BIGINT UNSIGNED DEFAULT NULL,
  `status` ENUM('draft','sent','accepted','rejected','expired','converted') NOT NULL DEFAULT 'draft',
  `items_subtotal` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `discount_type` ENUM('none','percentage','fixed') NOT NULL DEFAULT 'none',
  `discount_value` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `discount_amount` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `total_amount` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `notes` TEXT DEFAULT NULL,
  `sales_order_id` BIGINT UNSIGNED DEFAULT NULL,
  `sent_at` DATETIME NULL DEFAULT NULL,
  `converted_at` DATETIME NULL DEFAULT NULL,
  `delete_flg` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) DEFAULT NULL,
  `updated_ip` VARCHAR(45) DEFAULT NULL,
  CONSTRAINT `uq_quotations_quote_number` UNIQUE (`quote_number`),
  CONSTRAINT `uq_quotations_sales_order_id` UNIQUE (`sales_order_id`),
  INDEX `idx_quotations_customer_id` (`customer_id`),
  INDEX `idx_quotations_payment_term_id` (`payment_term_id`),
  INDEX `idx_quotations_agent_id` (`agent_id`),
  INDEX `idx_quotations_status` (`status`),
  INDEX `idx_quotations_quote_date` (`quote_date`),
  INDEX `idx_quotations_valid_until` (`valid_until`),
  INDEX `idx_quotations_delete_flg` (`delete_flg`),
  CONSTRAINT `fk_quotations_customer_id` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`),
  CONSTRAINT `fk_quotations_payment_term_id` FOREIGN KEY (`payment_term_id`) REFERENCES `payment_terms`(`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_quotations_agent_id` FOREIGN KEY (`agent_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_quotations_sales_order_id` FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `quotation_items` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `quotation_id` BIGINT UNSIGNED NOT NULL,
  `product_id` BIGINT UNSIGNED NOT NULL,
  `product_variant_id` BIGINT UNSIGNED NOT NULL,
  `product_name` VARCHAR(255) NOT NULL,
  `variant_name` VARCHAR(255) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `quantity` INT NOT NULL,
  `unit_price` DECIMAL(15,2) NOT NULL,
  `unit_cost` DECIMAL(15,2) NOT NULL,
  `line_discount` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `line_total` DECIMAL(15,2) NOT NULL,
  `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_quotation_items_quotation_id` (`quotation_id`),
  INDEX `idx_quotation_items_product_id` (`product_id`),
  INDEX `idx_quotation_items_product_variant_id` (`product_variant_id`),
  CONSTRAINT `fk_quotation_items_quotation_id` FOREIGN KEY (`quotation_id`) REFERENCES `quotations`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_quotation_items_product_id` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`),
  CONSTRAINT `fk_quotation_items_product_variant_id` FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- deliveries and mapping
CREATE TABLE IF NOT EXISTS `deliveries` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `delivery_number` VARCHAR(50) NOT NULL,
  `delivery_date` DATE NOT NULL,
  `driver_id` BIGINT UNSIGNED DEFAULT NULL,
  `truck_id` BIGINT UNSIGNED DEFAULT NULL,
  `status` ENUM('pending','in_transit','delivered','cancelled') NOT NULL DEFAULT 'pending',
  `notes` TEXT DEFAULT NULL,
  `departure_time` DATETIME NULL DEFAULT NULL,
  `completion_time` DATETIME NULL DEFAULT NULL,
  `delete_flg` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) DEFAULT NULL,
  `updated_ip` VARCHAR(45) DEFAULT NULL,
  CONSTRAINT `uq_deliveries_delivery_number` UNIQUE (`delivery_number`),
  INDEX `idx_deliveries_delivery_date` (`delivery_date`),
  INDEX `idx_deliveries_driver_id` (`driver_id`),
  INDEX `idx_deliveries_truck_id` (`truck_id`),
  INDEX `idx_deliveries_status` (`status`),
  INDEX `idx_deliveries_delete_flg` (`delete_flg`),
  CONSTRAINT `fk_deliveries_driver_id` FOREIGN KEY (`driver_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_deliveries_truck_id` FOREIGN KEY (`truck_id`) REFERENCES `trucks`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `delivery_sales_orders` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `delivery_id` BIGINT UNSIGNED NOT NULL,
  `sales_order_id` BIGINT UNSIGNED NOT NULL,
  `sequence_order` INT NOT NULL DEFAULT 1,
  `delivery_status` ENUM('pending','delivered','failed') NOT NULL DEFAULT 'pending',
  `delivered_at` DATETIME NULL DEFAULT NULL,
  `delivery_notes` TEXT DEFAULT NULL,
  `recipient_name` VARCHAR(255) DEFAULT NULL,
  `recipient_signature` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `uq_delivery_sales_orders_delivery_sales_order` UNIQUE (`delivery_id`, `sales_order_id`),
  INDEX `idx_delivery_sales_orders_delivery_id` (`delivery_id`),
  INDEX `idx_delivery_sales_orders_sales_order_id` (`sales_order_id`),
  INDEX `idx_delivery_sales_orders_delivery_status` (`delivery_status`),
  CONSTRAINT `fk_delivery_sales_orders_delivery_id` FOREIGN KEY (`delivery_id`) REFERENCES `deliveries`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_delivery_sales_orders_sales_order_id` FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- customer returns and items
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
  CONSTRAINT `fk_customer_returns_customer`
    FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_customer_returns_invoice`
    FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE SET NULL
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
  CONSTRAINT `fk_customer_return_items_return`
    FOREIGN KEY (`customer_return_id`) REFERENCES `customer_returns` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_customer_return_items_product`
    FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_customer_return_items_variant`
    FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `return_allocations` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `customer_return_id` BIGINT UNSIGNED NOT NULL,
  `accounts_receivable_id` BIGINT UNSIGNED NOT NULL,
  `amount_allocated` DECIMAL(15,2) NOT NULL,
  `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) DEFAULT NULL,
  `updated_ip` VARCHAR(45) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_return_allocations_return_ar` (`customer_return_id`, `accounts_receivable_id`),
  KEY `idx_return_allocations_customer_return_id` (`customer_return_id`),
  KEY `idx_return_allocations_accounts_receivable_id` (`accounts_receivable_id`),
  CONSTRAINT `fk_return_allocations_customer_return_id`
    FOREIGN KEY (`customer_return_id`) REFERENCES `customer_returns`(`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_return_allocations_accounts_receivable_id`
    FOREIGN KEY (`accounts_receivable_id`) REFERENCES `accounts_receivable`(`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- seed/permission inserts for sales, quotations, deliveries
INSERT INTO `permissions` (`slug`, `name`, `description`) VALUES
  ('salesOrders.view', 'View Sales Orders', 'Access sales order records and summaries'),
  ('salesOrders.create', 'Create Sales Orders', 'Create new sales orders'),
  ('salesOrders.update', 'Update Sales Orders', 'Edit existing sales orders'),
  ('salesOrders.delete', 'Delete Sales Orders', 'Remove or cancel sales orders'),
  ('quotations.view', 'View Quotations', 'Access quotation records and summaries'),
  ('quotations.create', 'Create Quotations', 'Create new quotations'),
  ('quotations.update', 'Update Quotations', 'Edit quotation details and statuses'),
  ('quotations.delete', 'Delete Quotations', 'Delete draft, rejected, or expired quotations'),
  ('deliveries.view', 'View Deliveries', 'Access delivery schedules and delivery notes'),
  ('deliveries.create', 'Create Deliveries', 'Create new delivery batches from sales orders'),
  ('deliveries.update', 'Update Deliveries', 'Update delivery schedules and statuses'),
  ('deliveries.delete', 'Delete Deliveries', 'Remove cancelled or pending deliveries'),
  ('payments.create', 'Create Customer Payments', 'Allow users to record customer payments')
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`);

INSERT INTO `role_permissions` (`role`, `permission_id`)
SELECT 'admin', `id`
FROM `permissions`
WHERE `slug` = 'payments.create'
ON DUPLICATE KEY UPDATE `permission_id` = VALUES(`permission_id`);

-- inventory_adjustments (header + items)
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
  `restock_flag` TINYINT(1) NOT NULL DEFAULT 1,
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
  KEY `idx_inventory_adjustment_items_restock_flag` (`restock_flag`),
  CONSTRAINT `fk_inventory_adjustment_items_adjustment_id` FOREIGN KEY (`inventory_adjustment_id`) REFERENCES `inventory_adjustments`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_inventory_adjustment_items_product_id` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_inventory_adjustment_items_variant_id` FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Settings and Activity Logs
CREATE TABLE IF NOT EXISTS `settings` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `key` VARCHAR(100) NOT NULL,
  `value` TEXT NULL,
  `category` VARCHAR(50) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_settings_key` (`key`),
  KEY `idx_settings_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `activity_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NULL,
  `action` VARCHAR(100) NOT NULL,
  `module` VARCHAR(100) NOT NULL,
  `description` TEXT NULL,
  `metadata` JSON NULL,
  `ip_address` VARCHAR(45) NULL,
  `user_agent` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_activity_logs_user_id` (`user_id`),
  KEY `idx_activity_logs_module` (`module`),
  KEY `idx_activity_logs_action` (`action`),
  CONSTRAINT `fk_activity_logs_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Combined Permissions for new tables
INSERT INTO `permissions` (`slug`, `name`, `description`) VALUES
  ('view_stock_adjustments', 'View Stock Adjustments', 'Allow users to view stock adjustment records'),
  ('create_stock_adjustments', 'Create Stock Adjustments', 'Allow users to create stock adjustments'),
  ('edit_stock_adjustments', 'Edit Stock Adjustments', 'Allow users to edit draft stock adjustments'),
  ('approve_stock_adjustments', 'Approve Stock Adjustments', 'Allow users to approve or reject stock adjustments'),
  ('delete_stock_adjustments', 'Delete Stock Adjustments', 'Allow users to delete stock adjustments'),
  ('export_stock_adjustments', 'Export Stock Adjustments', 'Allow users to export stock adjustments'),
  ('inventory.adjust', 'Adjust Stock', 'Allow users to apply stock adjustments and record movement logs'),
  ('inventory.viewLogs', 'View Stock Movement Logs', 'Allow users to view inventory transaction logs'),
  ('suppliers.view', 'View Suppliers', 'Access supplier records and summaries'),
  ('suppliers.create', 'Create Suppliers', 'Create new suppliers'),
  ('suppliers.update', 'Update Suppliers', 'Edit existing suppliers'),
  ('suppliers.delete', 'Delete Suppliers', 'Remove or disable suppliers'),
  ('purchaseOrders.view', 'View Purchase Orders', 'Access purchase order records and summaries'),
  ('purchaseOrders.create', 'Create Purchase Orders', 'Create new purchase orders'),
  ('purchaseOrders.update', 'Update Purchase Orders', 'Edit existing purchase orders'),
  ('purchaseOrders.delete', 'Delete Purchase Orders', 'Remove or cancel purchase orders'),
  ('purchaseOrders.approve', 'Approve Purchase Orders', 'Approve purchase orders for processing'),
  ('settings.view', 'View System Settings', 'Allow users to view global system settings'),
  ('settings.update', 'Update System Settings', 'Allow users to update branding and configuration'),
  ('activityLogs.view', 'View Activity Logs', 'Allow users to view the system audit trail')
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`);

-- Assign all new to admin
INSERT INTO `role_permissions` (`role`, `permission_id`)
SELECT 'admin', `id`
FROM `permissions`
WHERE `slug` IN (
  'view_stock_adjustments', 'create_stock_adjustments', 'edit_stock_adjustments', 
  'approve_stock_adjustments', 'delete_stock_adjustments', 'export_stock_adjustments',
  'inventory.adjust', 'inventory.viewLogs',
  'suppliers.view', 'suppliers.create', 'suppliers.update', 'suppliers.delete',
  'purchaseOrders.view', 'purchaseOrders.create', 'purchaseOrders.update', 'purchaseOrders.delete', 'purchaseOrders.approve',
  'settings.view', 'settings.update', 'activityLogs.view'
)
ON DUPLICATE KEY UPDATE `permission_id` = VALUES(`permission_id`);

-- final notes: this combined file creates a fresh database schema incorporating earlier ALTERs
-- Run with: mysql -u root -p < sql/jrspc-system/jrspc_nodeapi_combined.sql
