USE `jrspc_node`;

ALTER TABLE purchase_orders 
MODIFY COLUMN status ENUM('pending','approved','received','cancelled') NOT NULL DEFAULT 'pending';
