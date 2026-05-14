USE `saas`;

CREATE TABLE IF NOT EXISTS `document_sequences` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `branch_id` BIGINT UNSIGNED NOT NULL,
  `document_type` VARCHAR(50) NOT NULL,
  `prefix` VARCHAR(20) NULL,
  `next_number` BIGINT UNSIGNED NOT NULL DEFAULT 1,
  `number_padding` INT NOT NULL DEFAULT 5,
  `reset_policy` ENUM('none', 'yearly', 'monthly') NOT NULL DEFAULT 'none',
  `last_reset_at` DATETIME NULL,
  `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_document_sequences_scope` (`tenant_id`, `branch_id`, `document_type`),
  KEY `idx_document_sequences_branch_id` (`branch_id`),
  CONSTRAINT `fk_document_sequences_tenant_id`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_document_sequences_branch_id`
    FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `branch_inventory_balances` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `branch_id` BIGINT UNSIGNED NOT NULL,
  `product_id` BIGINT UNSIGNED NOT NULL,
  `product_variant_id` BIGINT UNSIGNED NOT NULL,
  `on_hand_qty` INT NOT NULL DEFAULT 0,
  `reserved_qty` INT NOT NULL DEFAULT 0,
  `reorder_level` INT NOT NULL DEFAULT 0,
  `last_counted_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_branch_inventory_balances_branch_variant` (`branch_id`, `product_variant_id`),
  KEY `idx_branch_inventory_balances_tenant_branch` (`tenant_id`, `branch_id`),
  KEY `idx_branch_inventory_balances_branch_id` (`branch_id`),
  KEY `idx_branch_inventory_balances_product_id` (`product_id`),
  KEY `idx_branch_inventory_balances_product_variant_id` (`product_variant_id`),
  CONSTRAINT `fk_branch_inventory_balances_tenant_id`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_branch_inventory_balances_branch_id`
    FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_branch_inventory_balances_product_id`
    FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_branch_inventory_balances_product_variant_id`
    FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sales_orders` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `branch_id` BIGINT UNSIGNED NULL,
  `sales_order_number` VARCHAR(50) NOT NULL,
  `customer_id` BIGINT UNSIGNED NOT NULL,
  `order_date` DATE NOT NULL,
  `agent_id` BIGINT UNSIGNED NULL,
  `payment_term_id` INT NULL,
  `status` ENUM('pending', 'processing', 'for_delivery', 'delivered', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
  `items_subtotal` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `discount_type` ENUM('none', 'percentage', 'fixed') NOT NULL DEFAULT 'none',
  `discount_value` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `discount_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `total_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `notes` TEXT NULL,
  `delete_flg` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) NULL,
  `updated_ip` VARCHAR(45) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sales_orders_tenant_number` (`tenant_id`, `sales_order_number`),
  KEY `idx_sales_orders_tenant_branch` (`tenant_id`, `branch_id`),
  KEY `idx_sales_orders_customer_id` (`customer_id`),
  KEY `idx_sales_orders_agent_id` (`agent_id`),
  KEY `idx_sales_orders_payment_term_id` (`payment_term_id`),
  CONSTRAINT `fk_sales_orders_tenant_id`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_sales_orders_branch_id`
    FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_sales_orders_customer_id`
    FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_sales_orders_agent_id`
    FOREIGN KEY (`agent_id`) REFERENCES `employees` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_sales_orders_payment_term_id`
    FOREIGN KEY (`payment_term_id`) REFERENCES `payment_terms` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sales_order_items` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `sales_order_id` BIGINT UNSIGNED NOT NULL,
  `product_id` BIGINT UNSIGNED NOT NULL,
  `product_variant_id` BIGINT UNSIGNED NOT NULL,
  `product_name` VARCHAR(255) NOT NULL,
  `variant_name` VARCHAR(255) NOT NULL,
  `quantity` INT NOT NULL,
  `unit_price` DECIMAL(15, 2) NOT NULL,
  `unit_cost` DECIMAL(15, 2) NOT NULL,
  `line_discount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `line_total` DECIMAL(15, 2) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sales_order_items_tenant_order` (`tenant_id`, `sales_order_id`),
  KEY `idx_sales_order_items_sales_order_id` (`sales_order_id`),
  KEY `idx_sales_order_items_product_id` (`product_id`),
  KEY `idx_sales_order_items_product_variant_id` (`product_variant_id`),
  CONSTRAINT `fk_sales_order_items_tenant_id`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_sales_order_items_sales_order_id`
    FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_sales_order_items_product_id`
    FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_sales_order_items_product_variant_id`
    FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `purchase_orders` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `branch_id` BIGINT UNSIGNED NULL,
  `po_number` VARCHAR(50) NOT NULL,
  `supplier_id` BIGINT UNSIGNED NOT NULL,
  `order_date` DATE NOT NULL,
  `expected_date` DATE NULL,
  `payment_term_id` INT NULL,
  `status` ENUM('pending', 'approved', 'received', 'cancelled') NOT NULL DEFAULT 'pending',
  `items_subtotal` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `discount_type` ENUM('none', 'percentage', 'fixed') NOT NULL DEFAULT 'none',
  `discount_value` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `discount_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `total_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `received_total` DECIMAL(15, 2) NULL,
  `notes` TEXT NULL,
  `received_notes` TEXT NULL,
  `delete_flg` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `received_at` DATETIME NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) NULL,
  `updated_ip` VARCHAR(45) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_purchase_orders_tenant_number` (`tenant_id`, `po_number`),
  KEY `idx_purchase_orders_tenant_branch` (`tenant_id`, `branch_id`),
  KEY `idx_purchase_orders_supplier_id` (`supplier_id`),
  KEY `idx_purchase_orders_payment_term_id` (`payment_term_id`),
  CONSTRAINT `fk_purchase_orders_tenant_id`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_purchase_orders_branch_id`
    FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_purchase_orders_supplier_id`
    FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_purchase_orders_payment_term_id`
    FOREIGN KEY (`payment_term_id`) REFERENCES `payment_terms` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `purchase_order_items` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `purchase_order_id` BIGINT UNSIGNED NOT NULL,
  `product_id` BIGINT UNSIGNED NOT NULL,
  `product_variant_id` BIGINT UNSIGNED NOT NULL,
  `product_name` VARCHAR(255) NOT NULL,
  `variant_name` VARCHAR(255) NOT NULL,
  `quantity` INT NOT NULL,
  `received_quantity` INT NULL,
  `unit_cost` DECIMAL(15, 2) NOT NULL,
  `received_unit_cost` DECIMAL(15, 2) NULL,
  `line_discount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `line_total` DECIMAL(15, 2) NOT NULL,
  `received_line_total` DECIMAL(15, 2) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_purchase_order_items_tenant_po` (`tenant_id`, `purchase_order_id`),
  KEY `idx_purchase_order_items_po_id` (`purchase_order_id`),
  KEY `idx_purchase_order_items_product_id` (`product_id`),
  KEY `idx_purchase_order_items_product_variant_id` (`product_variant_id`),
  CONSTRAINT `fk_purchase_order_items_tenant_id`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_purchase_order_items_po_id`
    FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_purchase_order_items_product_id`
    FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_purchase_order_items_product_variant_id`
    FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `inventory_transactions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `branch_id` BIGINT UNSIGNED NULL,
  `product_id` BIGINT UNSIGNED NOT NULL,
  `product_variant_id` BIGINT UNSIGNED NOT NULL,
  `quantity_before` INT NOT NULL DEFAULT 0,
  `quantity_change` INT NOT NULL,
  `quantity_after` INT NOT NULL DEFAULT 0,
  `transaction_type` TINYINT NOT NULL,
  `reference_type` VARCHAR(50) NULL,
  `reference_id` BIGINT UNSIGNED NULL,
  `reason` TEXT NULL,
  `created_by` BIGINT UNSIGNED NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) NULL,
  `updated_ip` VARCHAR(45) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_inventory_transactions_tenant_branch` (`tenant_id`, `branch_id`),
  KEY `idx_inventory_transactions_branch_id` (`branch_id`),
  KEY `idx_inventory_transactions_product_id` (`product_id`),
  KEY `idx_inventory_transactions_product_variant_id` (`product_variant_id`),
  KEY `idx_inventory_transactions_created_by` (`created_by`),
  CONSTRAINT `fk_inventory_transactions_tenant_id`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_inventory_transactions_branch_id`
    FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_inventory_transactions_product_id`
    FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_inventory_transactions_product_variant_id`
    FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_inventory_transactions_created_by`
    FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `quotations` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `branch_id` BIGINT UNSIGNED NULL,
  `quote_number` VARCHAR(50) NOT NULL,
  `customer_id` BIGINT UNSIGNED NOT NULL,
  `contact_person` VARCHAR(255) NULL,
  `quote_date` DATE NOT NULL,
  `valid_until` DATE NOT NULL,
  `payment_term_id` INT NULL,
  `agent_id` BIGINT UNSIGNED NULL,
  `status` ENUM('draft', 'sent', 'accepted', 'rejected', 'expired', 'converted') NOT NULL DEFAULT 'draft',
  `items_subtotal` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `discount_type` ENUM('none', 'percentage', 'fixed') NOT NULL DEFAULT 'none',
  `discount_value` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `discount_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `total_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `notes` TEXT NULL,
  `sales_order_id` BIGINT UNSIGNED NULL,
  `sent_at` DATETIME NULL,
  `converted_at` DATETIME NULL,
  `delete_flg` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) NULL,
  `updated_ip` VARCHAR(45) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_quotations_tenant_quote_number` (`tenant_id`, `quote_number`),
  UNIQUE KEY `uq_quotations_sales_order_id` (`sales_order_id`),
  KEY `idx_quotations_customer_id` (`customer_id`),
  KEY `idx_quotations_payment_term_id` (`payment_term_id`),
  KEY `idx_quotations_agent_id` (`agent_id`),
  CONSTRAINT `fk_quotations_tenant_id`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_quotations_branch_id`
    FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_quotations_customer_id`
    FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_quotations_payment_term_id`
    FOREIGN KEY (`payment_term_id`) REFERENCES `payment_terms` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_quotations_agent_id`
    FOREIGN KEY (`agent_id`) REFERENCES `employees` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_quotations_sales_order_id`
    FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `quotation_items` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `quotation_id` BIGINT UNSIGNED NOT NULL,
  `product_id` BIGINT UNSIGNED NOT NULL,
  `product_variant_id` BIGINT UNSIGNED NOT NULL,
  `product_name` VARCHAR(255) NOT NULL,
  `variant_name` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `quantity` INT NOT NULL,
  `unit_price` DECIMAL(15, 2) NOT NULL,
  `unit_cost` DECIMAL(15, 2) NOT NULL,
  `line_discount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `line_total` DECIMAL(15, 2) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_quotation_items_tenant_quotation` (`tenant_id`, `quotation_id`),
  KEY `idx_quotation_items_quotation_id` (`quotation_id`),
  KEY `idx_quotation_items_product_id` (`product_id`),
  KEY `idx_quotation_items_product_variant_id` (`product_variant_id`),
  CONSTRAINT `fk_quotation_items_tenant_id`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_quotation_items_quotation_id`
    FOREIGN KEY (`quotation_id`) REFERENCES `quotations` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_quotation_items_product_id`
    FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_quotation_items_product_variant_id`
    FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `deliveries` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `branch_id` BIGINT UNSIGNED NULL,
  `delivery_number` VARCHAR(50) NOT NULL,
  `delivery_date` DATE NOT NULL,
  `driver_id` BIGINT UNSIGNED NULL,
  `truck_id` BIGINT UNSIGNED NULL,
  `status` ENUM('pending', 'in_transit', 'delivered', 'cancelled') NOT NULL DEFAULT 'pending',
  `notes` TEXT NULL,
  `departure_time` DATETIME NULL,
  `completion_time` DATETIME NULL,
  `delete_flg` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) NULL,
  `updated_ip` VARCHAR(45) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_deliveries_tenant_number` (`tenant_id`, `delivery_number`),
  KEY `idx_deliveries_driver_id` (`driver_id`),
  KEY `idx_deliveries_truck_id` (`truck_id`),
  CONSTRAINT `fk_deliveries_tenant_id`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_deliveries_branch_id`
    FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_deliveries_driver_id`
    FOREIGN KEY (`driver_id`) REFERENCES `employees` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_deliveries_truck_id`
    FOREIGN KEY (`truck_id`) REFERENCES `trucks` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `delivery_sales_orders` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `delivery_id` BIGINT UNSIGNED NOT NULL,
  `sales_order_id` BIGINT UNSIGNED NOT NULL,
  `sequence_order` INT NOT NULL DEFAULT 1,
  `delivery_status` ENUM('pending', 'delivered', 'failed') NOT NULL DEFAULT 'pending',
  `delivered_at` DATETIME NULL,
  `delivery_notes` TEXT NULL,
  `recipient_name` VARCHAR(255) NULL,
  `recipient_signature` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_delivery_sales_orders_delivery_sales_order` (`delivery_id`, `sales_order_id`),
  KEY `idx_delivery_sales_orders_tenant_delivery` (`tenant_id`, `delivery_id`),
  KEY `idx_delivery_sales_orders_delivery_id` (`delivery_id`),
  KEY `idx_delivery_sales_orders_sales_order_id` (`sales_order_id`),
  CONSTRAINT `fk_delivery_sales_orders_tenant_id`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_delivery_sales_orders_delivery_id`
    FOREIGN KEY (`delivery_id`) REFERENCES `deliveries` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_delivery_sales_orders_sales_order_id`
    FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `invoices` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `branch_id` BIGINT UNSIGNED NULL,
  `invoice_number` VARCHAR(50) NOT NULL,
  `sales_order_id` BIGINT UNSIGNED NULL,
  `customer_id` BIGINT UNSIGNED NOT NULL,
  `agent_id` BIGINT UNSIGNED NULL,
  `payment_term_id` INT NULL,
  `invoice_date` DATE NOT NULL,
  `due_date` DATE NULL,
  `gross_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `item_discount_total` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `subtotal` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `discount_type` ENUM('none', 'percentage', 'fixed') NOT NULL DEFAULT 'none',
  `discount_value` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `order_discount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `net_of_discounts` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `vatable_sales` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `vat_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `grand_total` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `paid_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `balance_due` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `status` ENUM('draft', 'issued', 'partial', 'paid', 'cancelled') NOT NULL DEFAULT 'draft',
  `remarks` VARCHAR(255) NULL,
  `delete_flg` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) NULL,
  `updated_ip` VARCHAR(45) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_invoices_tenant_number` (`tenant_id`, `invoice_number`),
  UNIQUE KEY `uq_invoices_sales_order_id` (`sales_order_id`),
  KEY `idx_invoices_customer_id` (`customer_id`),
  KEY `idx_invoices_agent_id` (`agent_id`),
  KEY `idx_invoices_payment_term_id` (`payment_term_id`),
  CONSTRAINT `fk_invoices_tenant_id`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_invoices_branch_id`
    FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_invoices_sales_order_id`
    FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_invoices_customer_id`
    FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_invoices_agent_id`
    FOREIGN KEY (`agent_id`) REFERENCES `employees` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_invoices_payment_term_id`
    FOREIGN KEY (`payment_term_id`) REFERENCES `payment_terms` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `invoice_items` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `invoice_id` BIGINT UNSIGNED NOT NULL,
  `product_id` BIGINT UNSIGNED NOT NULL,
  `product_variant_id` BIGINT UNSIGNED NOT NULL,
  `product_name` VARCHAR(255) NOT NULL,
  `variant_name` VARCHAR(255) NOT NULL,
  `quantity` INT NOT NULL,
  `unit_price` DECIMAL(15, 2) NOT NULL,
  `unit_cost` DECIMAL(15, 2) NOT NULL,
  `line_discount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `line_total` DECIMAL(15, 2) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_invoice_items_tenant_invoice` (`tenant_id`, `invoice_id`),
  KEY `idx_invoice_items_invoice_id` (`invoice_id`),
  KEY `idx_invoice_items_product_id` (`product_id`),
  KEY `idx_invoice_items_product_variant_id` (`product_variant_id`),
  CONSTRAINT `fk_invoice_items_tenant_id`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_invoice_items_invoice_id`
    FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_invoice_items_product_id`
    FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_invoice_items_product_variant_id`
    FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `accounts_receivable` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `invoice_id` BIGINT UNSIGNED NULL,
  `customer_id` BIGINT UNSIGNED NOT NULL,
  `agent_id` BIGINT UNSIGNED NULL,
  `invoice_date` DATE NOT NULL,
  `due_date` DATE NULL,
  `amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `paid_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `outstanding_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `is_opening_balance` TINYINT(1) NOT NULL DEFAULT 0,
  `status` ENUM('unpaid', 'partial', 'paid') NOT NULL DEFAULT 'unpaid',
  `delete_flg` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) NULL,
  `updated_ip` VARCHAR(45) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_accounts_receivable_invoice_id` (`invoice_id`),
  KEY `idx_accounts_receivable_tenant_customer` (`tenant_id`, `customer_id`),
  KEY `idx_accounts_receivable_invoice_id` (`invoice_id`),
  KEY `idx_accounts_receivable_customer_id` (`customer_id`),
  KEY `idx_accounts_receivable_agent_id` (`agent_id`),
  CONSTRAINT `fk_accounts_receivable_tenant_id`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_accounts_receivable_invoice_id`
    FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_accounts_receivable_customer_id`
    FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_accounts_receivable_agent_id`
    FOREIGN KEY (`agent_id`) REFERENCES `employees` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `payments` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `branch_id` BIGINT UNSIGNED NULL,
  `payment_number` VARCHAR(50) NOT NULL,
  `customer_id` BIGINT UNSIGNED NOT NULL,
  `payment_date` DATE NOT NULL,
  `payment_method` ENUM('cash', 'cheque', 'bank_transfer', 'credit_card', 'other') NOT NULL DEFAULT 'cash',
  `amount` DECIMAL(15, 2) NOT NULL,
  `reference_number` VARCHAR(100) NULL,
  `notes` TEXT NULL,
  `file_url` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) NULL,
  `updated_ip` VARCHAR(45) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_payments_tenant_number` (`tenant_id`, `payment_number`),
  KEY `idx_payments_branch_id` (`branch_id`),
  KEY `idx_payments_customer_id` (`customer_id`),
  CONSTRAINT `fk_payments_tenant_id`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_payments_branch_id`
    FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_payments_customer_id`
    FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `payment_allocations` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `payment_id` BIGINT UNSIGNED NOT NULL,
  `accounts_receivable_id` BIGINT UNSIGNED NOT NULL,
  `amount_allocated` DECIMAL(15, 2) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) NULL,
  `updated_ip` VARCHAR(45) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_payment_allocations_payment_ar` (`payment_id`, `accounts_receivable_id`),
  KEY `idx_payment_allocations_payment_id` (`payment_id`),
  KEY `idx_payment_allocations_accounts_receivable_id` (`accounts_receivable_id`),
  CONSTRAINT `fk_payment_allocations_tenant_id`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_payment_allocations_payment_id`
    FOREIGN KEY (`payment_id`) REFERENCES `payments` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_payment_allocations_accounts_receivable_id`
    FOREIGN KEY (`accounts_receivable_id`) REFERENCES `accounts_receivable` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `customer_returns` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `branch_id` BIGINT UNSIGNED NULL,
  `rma_number` VARCHAR(50) NOT NULL,
  `customer_id` BIGINT UNSIGNED NOT NULL,
  `invoice_id` BIGINT UNSIGNED NULL,
  `request_date` DATE NOT NULL,
  `reason` VARCHAR(100) NOT NULL,
  `disposition` VARCHAR(100) NOT NULL,
  `status` ENUM('draft', 'pending', 'approved', 'completed', 'rejected') NOT NULL DEFAULT 'draft',
  `total_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `notes` TEXT NULL,
  `delete_flg` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) NULL,
  `updated_ip` VARCHAR(45) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_customer_returns_tenant_rma_number` (`tenant_id`, `rma_number`),
  KEY `idx_customer_returns_branch_id` (`branch_id`),
  KEY `idx_customer_returns_customer_id` (`customer_id`),
  KEY `idx_customer_returns_invoice_id` (`invoice_id`),
  CONSTRAINT `fk_customer_returns_tenant_id`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_customer_returns_branch_id`
    FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_customer_returns_customer_id`
    FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_customer_returns_invoice_id`
    FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `customer_return_items` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
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
  KEY `idx_customer_return_items_tenant_return` (`tenant_id`, `customer_return_id`),
  KEY `idx_customer_return_items_return_id` (`customer_return_id`),
  KEY `idx_customer_return_items_product_id` (`product_id`),
  KEY `idx_customer_return_items_product_variant_id` (`product_variant_id`),
  CONSTRAINT `fk_customer_return_items_tenant_id`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_customer_return_items_return_id`
    FOREIGN KEY (`customer_return_id`) REFERENCES `customer_returns` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_customer_return_items_product_id`
    FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_customer_return_items_product_variant_id`
    FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `return_allocations` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `customer_return_id` BIGINT UNSIGNED NOT NULL,
  `accounts_receivable_id` BIGINT UNSIGNED NOT NULL,
  `amount_allocated` DECIMAL(15, 2) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) NULL,
  `updated_ip` VARCHAR(45) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_return_allocations_return_ar` (`customer_return_id`, `accounts_receivable_id`),
  KEY `idx_return_allocations_customer_return_id` (`customer_return_id`),
  KEY `idx_return_allocations_accounts_receivable_id` (`accounts_receivable_id`),
  CONSTRAINT `fk_return_allocations_tenant_id`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_return_allocations_customer_return_id`
    FOREIGN KEY (`customer_return_id`) REFERENCES `customer_returns` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_return_allocations_accounts_receivable_id`
    FOREIGN KEY (`accounts_receivable_id`) REFERENCES `accounts_receivable` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `inventory_adjustments` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `branch_id` BIGINT UNSIGNED NULL,
  `adjustment_number` VARCHAR(50) NOT NULL,
  `adjustment_date` DATETIME NOT NULL,
  `remarks` TEXT NULL,
  `reason` VARCHAR(255) NULL,
  `created_by` BIGINT UNSIGNED NULL,
  `status` ENUM('draft', 'pending', 'approved', 'rejected') NOT NULL DEFAULT 'draft',
  `reject_reason` VARCHAR(255) NULL,
  `delete_flg` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) NULL,
  `updated_ip` VARCHAR(45) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_inventory_adjustments_tenant_number` (`tenant_id`, `adjustment_number`),
  KEY `idx_inventory_adjustments_branch_id` (`branch_id`),
  KEY `idx_inventory_adjustments_created_by` (`created_by`),
  CONSTRAINT `fk_inventory_adjustments_tenant_id`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_inventory_adjustments_branch_id`
    FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_inventory_adjustments_created_by`
    FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `inventory_adjustment_items` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `inventory_adjustment_id` BIGINT UNSIGNED NOT NULL,
  `product_id` BIGINT UNSIGNED NOT NULL,
  `product_variant_id` BIGINT UNSIGNED NOT NULL,
  `adjust_type` ENUM('add', 'subtract') NOT NULL,
  `quantity_change` INT NOT NULL,
  `restock_flag` TINYINT(1) NOT NULL DEFAULT 1,
  `quantity_before` INT NOT NULL DEFAULT 0,
  `quantity_after` INT NOT NULL DEFAULT 0,
  `notes` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) NULL,
  `updated_ip` VARCHAR(45) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_inventory_adjustment_items_tenant_adjustment` (`tenant_id`, `inventory_adjustment_id`),
  KEY `idx_inventory_adjustment_items_adjustment_id` (`inventory_adjustment_id`),
  KEY `idx_inventory_adjustment_items_product_id` (`product_id`),
  KEY `idx_inventory_adjustment_items_product_variant_id` (`product_variant_id`),
  CONSTRAINT `fk_inventory_adjustment_items_tenant_id`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_inventory_adjustment_items_adjustment_id`
    FOREIGN KEY (`inventory_adjustment_id`) REFERENCES `inventory_adjustments` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_inventory_adjustment_items_product_id`
    FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_inventory_adjustment_items_product_variant_id`
    FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `accounts_payable` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `purchase_order_id` BIGINT UNSIGNED NOT NULL,
  `supplier_id` BIGINT UNSIGNED NOT NULL,
  `po_number` VARCHAR(50) NOT NULL,
  `receipt_date` DATE NOT NULL,
  `due_date` DATE NULL,
  `amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `paid_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `outstanding_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `status` ENUM('unpaid', 'partial', 'paid') NOT NULL DEFAULT 'unpaid',
  `notes` TEXT NULL,
  `delete_flg` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) NULL,
  `updated_ip` VARCHAR(45) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_accounts_payable_po_id` (`purchase_order_id`),
  KEY `idx_accounts_payable_tenant_supplier` (`tenant_id`, `supplier_id`),
  KEY `idx_accounts_payable_purchase_order_id` (`purchase_order_id`),
  KEY `idx_accounts_payable_supplier_id` (`supplier_id`),
  CONSTRAINT `fk_accounts_payable_tenant_id`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_accounts_payable_po_id`
    FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_accounts_payable_supplier_id`
    FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `supplier_payments` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `branch_id` BIGINT UNSIGNED NULL,
  `payment_number` VARCHAR(50) NOT NULL,
  `supplier_id` BIGINT UNSIGNED NOT NULL,
  `accounts_payable_id` BIGINT UNSIGNED NOT NULL,
  `payment_date` DATE NOT NULL,
  `payment_method` ENUM('cash', 'cheque', 'bank_transfer', 'credit_card', 'other') NOT NULL DEFAULT 'cash',
  `amount` DECIMAL(15, 2) NOT NULL,
  `reference_number` VARCHAR(100) NULL,
  `notes` TEXT NULL,
  `file_url` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) NULL,
  `updated_ip` VARCHAR(45) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_supplier_payments_tenant_number` (`tenant_id`, `payment_number`),
  KEY `idx_supplier_payments_branch_id` (`branch_id`),
  KEY `idx_supplier_payments_supplier_id` (`supplier_id`),
  KEY `idx_supplier_payments_accounts_payable_id` (`accounts_payable_id`),
  CONSTRAINT `fk_supplier_payments_tenant_id`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_supplier_payments_branch_id`
    FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_supplier_payments_supplier_id`
    FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_supplier_payments_accounts_payable_id`
    FOREIGN KEY (`accounts_payable_id`) REFERENCES `accounts_payable` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `recurring_business_expenses` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `category_id` INT NOT NULL,
  `amount` DECIMAL(15, 2) NOT NULL,
  `description` TEXT NULL,
  `payee` VARCHAR(255) NULL,
  `payment_method` ENUM('cash', 'cheque', 'bank_transfer', 'credit_card', 'other') NOT NULL DEFAULT 'cash',
  `frequency` ENUM('daily', 'weekly', 'monthly', 'annually') NOT NULL DEFAULT 'monthly',
  `day_of_month` INT NULL,
  `day_of_week` INT NULL,
  `month_of_year` INT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `last_run_date` DATE NULL,
  `next_run_date` DATE NULL,
  `created_by` BIGINT UNSIGNED NULL,
  `delete_flg` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) NULL,
  `updated_ip` VARCHAR(45) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_recurring_business_expenses_tenant_category` (`tenant_id`, `category_id`),
  KEY `idx_recurring_business_expenses_category_id` (`category_id`),
  KEY `idx_recurring_business_expenses_created_by` (`created_by`),
  CONSTRAINT `fk_recurring_business_expenses_tenant_id`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_recurring_business_expenses_category_id`
    FOREIGN KEY (`category_id`) REFERENCES `expense_categories` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_recurring_business_expenses_created_by`
    FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `payslips` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `branch_id` BIGINT UNSIGNED NULL,
  `payslip_number` VARCHAR(50) NOT NULL,
  `employee_id` BIGINT UNSIGNED NOT NULL,
  `period_start` DATE NOT NULL,
  `period_end` DATE NOT NULL,
  `pay_date` DATE NOT NULL,
  `gross_pay` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `overtime_pay` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `total_deductions` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `net_pay` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `notes` TEXT NULL,
  `metadata` JSON NULL,
  `status` ENUM('draft', 'released') NOT NULL DEFAULT 'draft',
  `delete_flg` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) NULL,
  `updated_ip` VARCHAR(45) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_payslips_tenant_number` (`tenant_id`, `payslip_number`),
  KEY `idx_payslips_branch_id` (`branch_id`),
  KEY `idx_payslips_employee_id` (`employee_id`),
  CONSTRAINT `fk_payslips_tenant_id`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_payslips_branch_id`
    FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_payslips_employee_id`
    FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `business_expenses` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `branch_id` BIGINT UNSIGNED NULL,
  `category_id` INT NOT NULL,
  `recurring_expense_id` BIGINT UNSIGNED NULL,
  `payslip_id` BIGINT UNSIGNED NULL,
  `amount` DECIMAL(15, 2) NOT NULL,
  `expense_date` DATE NOT NULL,
  `description` TEXT NULL,
  `payee` VARCHAR(255) NULL,
  `payment_method` ENUM('cash', 'cheque', 'bank_transfer', 'credit_card', 'other') NOT NULL DEFAULT 'cash',
  `reference_number` VARCHAR(100) NULL,
  `attachment_url` VARCHAR(255) NULL,
  `status` ENUM('draft', 'pending', 'paid', 'void') NOT NULL DEFAULT 'paid',
  `created_by` BIGINT UNSIGNED NULL,
  `delete_flg` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) NULL,
  `updated_ip` VARCHAR(45) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_business_expenses_tenant_branch` (`tenant_id`, `branch_id`),
  KEY `idx_business_expenses_branch_id` (`branch_id`),
  KEY `idx_business_expenses_category_id` (`category_id`),
  KEY `idx_business_expenses_recurring_expense_id` (`recurring_expense_id`),
  KEY `idx_business_expenses_payslip_id` (`payslip_id`),
  KEY `idx_business_expenses_created_by` (`created_by`),
  CONSTRAINT `fk_business_expenses_tenant_id`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_business_expenses_branch_id`
    FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_business_expenses_category_id`
    FOREIGN KEY (`category_id`) REFERENCES `expense_categories` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_business_expenses_recurring_expense_id`
    FOREIGN KEY (`recurring_expense_id`) REFERENCES `recurring_business_expenses` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_business_expenses_payslip_id`
    FOREIGN KEY (`payslip_id`) REFERENCES `payslips` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_business_expenses_created_by`
    FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `assistant_queries` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `user_id` BIGINT UNSIGNED NULL,
  `question` TEXT NOT NULL,
  `answer` TEXT NULL,
  `mode` VARCHAR(50) NOT NULL,
  `confidence` VARCHAR(20) NULL,
  `intent` VARCHAR(100) NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'success',
  `provider` VARCHAR(100) NULL,
  `model` VARCHAR(100) NULL,
  `context` JSON NULL,
  `sources` JSON NULL,
  `error_message` TEXT NULL,
  `ip_address` VARCHAR(45) NULL,
  `user_agent` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_assistant_queries_tenant_id` (`tenant_id`),
  KEY `idx_assistant_queries_user_id` (`user_id`),
  CONSTRAINT `fk_assistant_queries_tenant_id`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_assistant_queries_user_id`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `assistant_index_documents` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `document_key` VARCHAR(191) NOT NULL,
  `source_type` VARCHAR(50) NOT NULL,
  `module` VARCHAR(100) NOT NULL,
  `entity_type` VARCHAR(50) NOT NULL,
  `entity_id` BIGINT UNSIGNED NULL,
  `title` VARCHAR(255) NOT NULL,
  `content` TEXT NOT NULL,
  `metadata` JSON NULL,
  `last_indexed_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_assistant_index_documents_tenant_key` (`tenant_id`, `document_key`),
  CONSTRAINT `fk_assistant_index_documents_tenant_id`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `assistant_index_chunks` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `document_id` BIGINT UNSIGNED NOT NULL,
  `chunk_index` INT NOT NULL,
  `content` TEXT NOT NULL,
  `keywords` TEXT NULL,
  `embedding` JSON NULL,
  `metadata` JSON NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_assistant_index_chunks_document_chunk` (`document_id`, `chunk_index`),
  KEY `idx_assistant_index_chunks_document_id` (`document_id`),
  CONSTRAINT `fk_assistant_index_chunks_tenant_id`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_assistant_index_chunks_document_id`
    FOREIGN KEY (`document_id`) REFERENCES `assistant_index_documents` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
