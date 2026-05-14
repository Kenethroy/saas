USE `jrspc_node`;

ALTER TABLE `supplier_payments`
  MODIFY COLUMN `created_at` DATETIME NULL DEFAULT NULL,
  MODIFY COLUMN `updated_at` DATETIME NULL DEFAULT NULL;

DROP TRIGGER IF EXISTS `trg_supplier_payments_before_insert`;
DROP TRIGGER IF EXISTS `trg_supplier_payments_before_update`;
