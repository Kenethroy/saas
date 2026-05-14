USE `jrspc_node`;

ALTER TABLE `employees`
  MODIFY COLUMN `created_at` DATETIME NULL,
  MODIFY COLUMN `updated_at` DATETIME NULL;

ALTER TABLE `users`
  MODIFY COLUMN `created_at` DATETIME NULL,
  MODIFY COLUMN `updated_at` DATETIME NULL;

ALTER TABLE `user_sessions`
  MODIFY COLUMN `created_at` DATETIME NOT NULL;

ALTER TABLE `permissions`
  MODIFY COLUMN `created_at` DATETIME NULL,
  MODIFY COLUMN `updated_at` DATETIME NULL;

ALTER TABLE `role_permissions`
  MODIFY COLUMN `created_at` DATETIME NULL,
  MODIFY COLUMN `updated_at` DATETIME NULL;

ALTER TABLE `user_permissions`
  MODIFY COLUMN `created_at` DATETIME NULL,
  MODIFY COLUMN `updated_at` DATETIME NULL;

ALTER TABLE `payment_terms`
  MODIFY COLUMN `created_at` DATETIME NULL,
  MODIFY COLUMN `updated_at` DATETIME NULL;

ALTER TABLE `customers`
  MODIFY COLUMN `created_at` DATETIME NULL,
  MODIFY COLUMN `updated_at` DATETIME NULL;

ALTER TABLE `suppliers`
  MODIFY COLUMN `created` DATETIME NULL,
  MODIFY COLUMN `modified` DATETIME NULL;

ALTER TABLE `expense_categories`
  MODIFY COLUMN `created_at` DATETIME NULL,
  MODIFY COLUMN `updated_at` DATETIME NULL;

ALTER TABLE `business_expenses`
  MODIFY COLUMN `created_at` DATETIME NULL,
  MODIFY COLUMN `updated_at` DATETIME NULL;

ALTER TABLE `recurring_business_expenses`
  MODIFY COLUMN `created_at` DATETIME NULL,
  MODIFY COLUMN `updated_at` DATETIME NULL;

ALTER TABLE `categories`
  MODIFY COLUMN `created_at` DATETIME NULL,
  MODIFY COLUMN `updated_at` DATETIME NULL;

ALTER TABLE `products`
  MODIFY COLUMN `created_at` DATETIME NULL,
  MODIFY COLUMN `updated_at` DATETIME NULL;

ALTER TABLE `product_variants`
  MODIFY COLUMN `created_at` DATETIME NULL,
  MODIFY COLUMN `updated_at` DATETIME NULL;

ALTER TABLE `inventory_transactions`
  MODIFY COLUMN `created_at` DATETIME NULL,
  MODIFY COLUMN `updated_at` DATETIME NULL;

ALTER TABLE `inventory_adjustments`
  MODIFY COLUMN `created_at` DATETIME NULL,
  MODIFY COLUMN `updated_at` DATETIME NULL;

ALTER TABLE `inventory_adjustment_items`
  MODIFY COLUMN `created_at` DATETIME NULL,
  MODIFY COLUMN `updated_at` DATETIME NULL;

ALTER TABLE `trucks`
  MODIFY COLUMN `created_at` DATETIME NULL,
  MODIFY COLUMN `updated_at` DATETIME NULL;

ALTER TABLE `sales_orders`
  MODIFY COLUMN `created_at` DATETIME NULL,
  MODIFY COLUMN `updated_at` DATETIME NULL;

ALTER TABLE `quotations`
  MODIFY COLUMN `created_at` DATETIME NULL,
  MODIFY COLUMN `updated_at` DATETIME NULL;

ALTER TABLE `invoices`
  MODIFY COLUMN `created_at` DATETIME NULL,
  MODIFY COLUMN `updated_at` DATETIME NULL;

ALTER TABLE `deliveries`
  MODIFY COLUMN `created_at` DATETIME NULL,
  MODIFY COLUMN `updated_at` DATETIME NULL;

ALTER TABLE `delivery_sales_orders`
  MODIFY COLUMN `created_at` DATETIME NULL,
  MODIFY COLUMN `updated_at` DATETIME NULL;

ALTER TABLE `accounts_receivable`
  MODIFY COLUMN `created_at` DATETIME NULL,
  MODIFY COLUMN `updated_at` DATETIME NULL;

ALTER TABLE `accounts_payable`
  MODIFY COLUMN `created_at` DATETIME NULL,
  MODIFY COLUMN `updated_at` DATETIME NULL;

ALTER TABLE `supplier_payments`
  MODIFY COLUMN `created_at` DATETIME NULL,
  MODIFY COLUMN `updated_at` DATETIME NULL;

ALTER TABLE `payments`
  MODIFY COLUMN `created_at` DATETIME NULL,
  MODIFY COLUMN `updated_at` DATETIME NULL;

ALTER TABLE `payment_allocations`
  MODIFY COLUMN `created_at` DATETIME NULL,
  MODIFY COLUMN `updated_at` DATETIME NULL;

ALTER TABLE `return_allocations`
  MODIFY COLUMN `created_at` DATETIME NULL,
  MODIFY COLUMN `updated_at` DATETIME NULL;

ALTER TABLE `invoice_items`
  MODIFY COLUMN `created_at` DATETIME NULL,
  MODIFY COLUMN `updated_at` DATETIME NULL;

ALTER TABLE `sales_order_items`
  MODIFY COLUMN `created_at` DATETIME NULL,
  MODIFY COLUMN `updated_at` DATETIME NULL;

ALTER TABLE `quotation_items`
  MODIFY COLUMN `created_at` DATETIME NULL,
  MODIFY COLUMN `updated_at` DATETIME NULL;

ALTER TABLE `customer_returns`
  MODIFY COLUMN `created_at` DATETIME NULL,
  MODIFY COLUMN `updated_at` DATETIME NULL;

ALTER TABLE `customer_return_items`
  MODIFY COLUMN `created_at` DATETIME NULL,
  MODIFY COLUMN `updated_at` DATETIME NULL;

ALTER TABLE `settings`
  MODIFY COLUMN `created_at` DATETIME NULL,
  MODIFY COLUMN `updated_at` DATETIME NULL;

ALTER TABLE `activity_logs`
  MODIFY COLUMN `created_at` DATETIME NULL;

ALTER TABLE `purchase_orders`
  MODIFY COLUMN `created_at` DATETIME NULL,
  MODIFY COLUMN `updated_at` DATETIME NULL;

ALTER TABLE `purchase_order_items`
  MODIFY COLUMN `created_at` DATETIME NULL,
  MODIFY COLUMN `updated_at` DATETIME NULL;

DROP TRIGGER IF EXISTS `trg_supplier_payments_before_insert`;
DROP TRIGGER IF EXISTS `trg_supplier_payments_before_update`;
