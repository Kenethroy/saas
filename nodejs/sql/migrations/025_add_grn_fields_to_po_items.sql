USE `jrspc_node`;

-- Add GRN (Goods Receipt Note) fields to purchase_order_items
-- These capture actual received values which may differ from ordered values
ALTER TABLE purchase_order_items
  ADD COLUMN `received_quantity`  INT            NULL DEFAULT NULL AFTER `quantity`,
  ADD COLUMN `received_unit_cost` DECIMAL(15,2)  NULL DEFAULT NULL AFTER `unit_cost`,
  ADD COLUMN `received_line_total` DECIMAL(15,2) NULL DEFAULT NULL AFTER `line_total`;

-- Add GRN summary fields to purchase_orders
-- received_total reflects actual payable amount (may differ from total_amount which is the PO estimate)
ALTER TABLE purchase_orders
  ADD COLUMN `received_total`   DECIMAL(15,2) NULL DEFAULT NULL AFTER `total_amount`,
  ADD COLUMN `received_at`      DATETIME      NULL DEFAULT NULL AFTER `updated_at`,
  ADD COLUMN `received_notes`   TEXT          NULL DEFAULT NULL AFTER `notes`;
