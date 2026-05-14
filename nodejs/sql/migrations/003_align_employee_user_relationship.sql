USE `jrspc_node`;

ALTER TABLE `employees`
  DROP FOREIGN KEY `fk_employees_user_id`;

ALTER TABLE `employees`
  DROP INDEX `uq_employees_user_id`;

ALTER TABLE `employees`
  DROP COLUMN `user_id`;

ALTER TABLE `users`
  ADD COLUMN `employee_id` BIGINT UNSIGNED NULL AFTER `id`,
  ADD UNIQUE KEY `uq_users_employee_id` (`employee_id`),
  ADD CONSTRAINT `fk_users_employee_id`
    FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE;
