USE `jrspc_node`;

INSERT INTO `permissions` (`slug`, `name`, `description`) VALUES
  ('users.delete', 'Delete Users', 'Allow users to remove user access')
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`);
