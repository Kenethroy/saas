USE `jrspc_node`;

-- Add per-item restock flag for inventory adjustments (used for damaged/lost workflows).

ALTER TABLE `inventory_adjustment_items`
  ADD COLUMN `restock_flag` TINYINT(1) NOT NULL DEFAULT 1 AFTER `quantity_change`;

CREATE INDEX `idx_inventory_adjustment_items_restock_flag`
  ON `inventory_adjustment_items` (`restock_flag`);

