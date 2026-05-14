USE `jrspc_node`;

-- Inventory module permissions for stock adjustments and movement logs.

INSERT INTO `permissions` (`slug`, `name`, `description`, `status`, `delete_flg`, `created_at`, `updated_at`) VALUES
  ('inventory.adjust', 'Adjust Stock', 'Allow users to apply stock adjustments and record movement logs', 1, 0, NOW(), NOW()),
  ('inventory.viewLogs', 'View Stock Movement Logs', 'Allow users to view inventory transaction logs', 1, 0, NOW(), NOW())
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`),
  `status` = VALUES(`status`),
  `delete_flg` = VALUES(`delete_flg`),
  `updated_at` = NOW();

INSERT INTO `role_permissions` (`role`, `permission_id`)
SELECT 'admin', `id`
FROM `permissions`
WHERE `slug` IN ('inventory.adjust', 'inventory.viewLogs')
ON DUPLICATE KEY UPDATE `permission_id` = VALUES(`permission_id`);

