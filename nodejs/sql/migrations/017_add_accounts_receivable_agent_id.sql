USE `jrspc_node`;

-- Adds agent_id to accounts_receivable (nullable) for linking AR entries to the sales agent.
-- Safe to run multiple times.

SET @has_agent_id := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'accounts_receivable'
    AND COLUMN_NAME = 'agent_id'
);

SET @sql_add_column := IF(
  @has_agent_id = 0,
  'ALTER TABLE `accounts_receivable` ADD COLUMN `agent_id` BIGINT UNSIGNED DEFAULT NULL AFTER `customer_id`',
  'SELECT 1'
);
PREPARE stmt FROM @sql_add_column;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_agent_idx := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'accounts_receivable'
    AND INDEX_NAME = 'idx_accounts_receivable_agent_id'
);

SET @sql_add_index := IF(
  @has_agent_idx = 0,
  'ALTER TABLE `accounts_receivable` ADD KEY `idx_accounts_receivable_agent_id` (`agent_id`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql_add_index;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_agent_fk := (
  SELECT COUNT(*)
  FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND CONSTRAINT_NAME = 'fk_accounts_receivable_agent_id'
);

SET @sql_add_fk := IF(
  @has_agent_fk = 0,
  'ALTER TABLE `accounts_receivable` ADD CONSTRAINT `fk_accounts_receivable_agent_id` FOREIGN KEY (`agent_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql_add_fk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
