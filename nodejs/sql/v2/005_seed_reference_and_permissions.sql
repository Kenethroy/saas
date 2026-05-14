USE `saas`;

INSERT INTO `subscription_plans` (
  `code`, `name`, `description`, `price_monthly`, `price_yearly`,
  `max_branches`, `max_users`, `max_products`, `max_storage_gb`,
  `allow_reports`, `allow_backup`, `allow_api_access`, `allow_multi_branch`,
  `is_active`, `created_at`, `updated_at`
) VALUES
  ('starter', 'Starter', 'Starter plan for small businesses.', 999.00, 9990.00, 1, 3, 500, 5, 1, 0, 0, 0, 1, NOW(), NOW()),
  ('pro', 'Pro', 'Pro plan for growing businesses.', 2999.00, 29990.00, 3, 10, NULL, 25, 1, 1, 0, 1, 1, NOW(), NOW()),
  ('enterprise', 'Enterprise', 'Enterprise plan with expanded limits.', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, 1, 1, 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`),
  `price_monthly` = VALUES(`price_monthly`),
  `price_yearly` = VALUES(`price_yearly`),
  `max_branches` = VALUES(`max_branches`),
  `max_users` = VALUES(`max_users`),
  `max_products` = VALUES(`max_products`),
  `max_storage_gb` = VALUES(`max_storage_gb`),
  `allow_reports` = VALUES(`allow_reports`),
  `allow_backup` = VALUES(`allow_backup`),
  `allow_api_access` = VALUES(`allow_api_access`),
  `allow_multi_branch` = VALUES(`allow_multi_branch`),
  `is_active` = VALUES(`is_active`),
  `updated_at` = NOW();

INSERT INTO `app_reserved_subdomains` (`name`, `reason`) VALUES
  ('www', 'Reserved for marketing site'),
  ('api', 'Reserved for API'),
  ('admin', 'Reserved for platform admin'),
  ('app', 'Reserved for general app entry'),
  ('mail', 'Reserved for mail services'),
  ('root', 'Reserved system name'),
  ('support', 'Reserved for support'),
  ('help', 'Reserved for help center'),
  ('billing', 'Reserved for billing'),
  ('dashboard', 'Reserved system name'),
  ('cdn', 'Reserved for CDN'),
  ('assets', 'Reserved for assets'),
  ('static', 'Reserved for static files')
ON DUPLICATE KEY UPDATE
  `reason` = VALUES(`reason`);

INSERT INTO `permissions` (`slug`, `name`, `description`, `status`, `delete_flg`, `created_at`, `updated_at`) VALUES
  ('employees.view', 'View Employees', 'Allow users to view employee records', 1, 0, NOW(), NOW()),
  ('employees.create', 'Create Employees', 'Allow users to create employee records', 1, 0, NOW(), NOW()),
  ('employees.update', 'Update Employees', 'Allow users to update employee records', 1, 0, NOW(), NOW()),
  ('employees.delete', 'Delete Employees', 'Allow users to archive employee records', 1, 0, NOW(), NOW()),
  ('users.view', 'View Users', 'Allow users to view users', 1, 0, NOW(), NOW()),
  ('users.create', 'Create Users', 'Allow users to create users', 1, 0, NOW(), NOW()),
  ('users.update', 'Update Users', 'Allow users to update users', 1, 0, NOW(), NOW()),
  ('users.delete', 'Delete Users', 'Allow users to remove user access', 1, 0, NOW(), NOW()),
  ('users.permissions.manage', 'Manage User Permissions', 'Allow users to manage roles and permissions', 1, 0, NOW(), NOW()),
  ('tenant.profile.view', 'View Tenant Profile', 'Allow users to view tenant profile', 1, 0, NOW(), NOW()),
  ('tenant.profile.update', 'Update Tenant Profile', 'Allow users to update tenant profile', 1, 0, NOW(), NOW()),
  ('tenant.subdomain.update', 'Update Tenant Subdomain', 'Allow users to update tenant subdomain', 1, 0, NOW(), NOW()),
  ('subscription.view', 'View Subscription', 'Allow users to view subscription details', 1, 0, NOW(), NOW()),
  ('subscription.manage', 'Manage Subscription', 'Allow users to manage subscription details', 1, 0, NOW(), NOW()),
  ('branches.view', 'View Branches', 'Allow users to view branches', 1, 0, NOW(), NOW()),
  ('branches.create', 'Create Branches', 'Allow users to create branches', 1, 0, NOW(), NOW()),
  ('branches.update', 'Update Branches', 'Allow users to update branches', 1, 0, NOW(), NOW()),
  ('branches.delete', 'Delete Branches', 'Allow users to archive branches', 1, 0, NOW(), NOW()),
  ('paymentTerms.view', 'View Payment Terms', 'Allow users to view payment terms', 1, 0, NOW(), NOW()),
  ('paymentTerms.create', 'Create Payment Terms', 'Allow users to create payment terms', 1, 0, NOW(), NOW()),
  ('paymentTerms.update', 'Update Payment Terms', 'Allow users to update payment terms', 1, 0, NOW(), NOW()),
  ('paymentTerms.delete', 'Delete Payment Terms', 'Allow users to delete payment terms', 1, 0, NOW(), NOW()),
  ('categories.view', 'View Categories', 'Allow users to view categories', 1, 0, NOW(), NOW()),
  ('categories.create', 'Create Categories', 'Allow users to create categories', 1, 0, NOW(), NOW()),
  ('categories.update', 'Update Categories', 'Allow users to update categories', 1, 0, NOW(), NOW()),
  ('categories.delete', 'Delete Categories', 'Allow users to delete categories', 1, 0, NOW(), NOW()),
  ('products.view', 'View Products', 'Allow users to view product families and variants', 1, 0, NOW(), NOW()),
  ('products.create', 'Create Products', 'Allow users to create product families and variants', 1, 0, NOW(), NOW()),
  ('products.update', 'Update Products', 'Allow users to update product families and variants', 1, 0, NOW(), NOW()),
  ('products.delete', 'Delete Products', 'Allow users to soft delete product families and variants', 1, 0, NOW(), NOW()),
  ('trucks.view', 'View Trucks', 'Allow users to view trucks', 1, 0, NOW(), NOW()),
  ('trucks.create', 'Create Trucks', 'Allow users to create trucks', 1, 0, NOW(), NOW()),
  ('trucks.update', 'Update Trucks', 'Allow users to update trucks', 1, 0, NOW(), NOW()),
  ('trucks.delete', 'Delete Trucks', 'Allow users to delete trucks', 1, 0, NOW(), NOW()),
  ('customers.view', 'View Customers', 'Allow users to view customers', 1, 0, NOW(), NOW()),
  ('customers.create', 'Create Customers', 'Allow users to create customers', 1, 0, NOW(), NOW()),
  ('customers.update', 'Update Customers', 'Allow users to update customers', 1, 0, NOW(), NOW()),
  ('customers.delete', 'Delete Customers', 'Allow users to archive customers', 1, 0, NOW(), NOW()),
  ('suppliers.view', 'View Suppliers', 'Allow users to view suppliers', 1, 0, NOW(), NOW()),
  ('suppliers.create', 'Create Suppliers', 'Allow users to create suppliers', 1, 0, NOW(), NOW()),
  ('suppliers.update', 'Update Suppliers', 'Allow users to update suppliers', 1, 0, NOW(), NOW()),
  ('suppliers.delete', 'Delete Suppliers', 'Allow users to archive suppliers', 1, 0, NOW(), NOW()),
  ('salesOrders.view', 'View Sales Orders', 'Access sales order records and summaries', 1, 0, NOW(), NOW()),
  ('salesOrders.create', 'Create Sales Orders', 'Create new sales orders', 1, 0, NOW(), NOW()),
  ('salesOrders.update', 'Update Sales Orders', 'Edit existing sales orders', 1, 0, NOW(), NOW()),
  ('salesOrders.delete', 'Delete Sales Orders', 'Remove or cancel sales orders', 1, 0, NOW(), NOW()),
  ('quotations.view', 'View Quotations', 'Access quotation records and summaries', 1, 0, NOW(), NOW()),
  ('quotations.create', 'Create Quotations', 'Create new quotations', 1, 0, NOW(), NOW()),
  ('quotations.update', 'Update Quotations', 'Edit quotation details and statuses', 1, 0, NOW(), NOW()),
  ('quotations.delete', 'Delete Quotations', 'Delete draft, rejected, or expired quotations', 1, 0, NOW(), NOW()),
  ('deliveries.view', 'View Deliveries', 'Access delivery schedules and delivery notes', 1, 0, NOW(), NOW()),
  ('deliveries.create', 'Create Deliveries', 'Create new delivery batches from sales orders', 1, 0, NOW(), NOW()),
  ('deliveries.update', 'Update Deliveries', 'Update delivery schedules and statuses', 1, 0, NOW(), NOW()),
  ('deliveries.delete', 'Delete Deliveries', 'Remove cancelled or pending deliveries', 1, 0, NOW(), NOW()),
  ('inventory.adjust', 'Adjust Stock', 'Allow users to apply stock adjustments and record movement logs', 1, 0, NOW(), NOW()),
  ('inventory.viewLogs', 'View Stock Movement Logs', 'Allow users to view inventory transaction logs', 1, 0, NOW(), NOW()),
  ('view_stock_adjustments', 'View Stock Adjustments', 'Allow users to view stock adjustment records', 1, 0, NOW(), NOW()),
  ('create_stock_adjustments', 'Create Stock Adjustments', 'Allow users to create stock adjustments', 1, 0, NOW(), NOW()),
  ('edit_stock_adjustments', 'Edit Stock Adjustments', 'Allow users to edit draft stock adjustments', 1, 0, NOW(), NOW()),
  ('approve_stock_adjustments', 'Approve Stock Adjustments', 'Allow users to approve or reject stock adjustments', 1, 0, NOW(), NOW()),
  ('delete_stock_adjustments', 'Delete Stock Adjustments', 'Allow users to delete stock adjustments', 1, 0, NOW(), NOW()),
  ('export_stock_adjustments', 'Export Stock Adjustments', 'Allow users to export stock adjustments', 1, 0, NOW(), NOW()),
  ('purchaseOrders.view', 'View Purchase Orders', 'Access purchase order records and summaries', 1, 0, NOW(), NOW()),
  ('purchaseOrders.create', 'Create Purchase Orders', 'Create new purchase orders', 1, 0, NOW(), NOW()),
  ('purchaseOrders.update', 'Update Purchase Orders', 'Edit existing purchase orders', 1, 0, NOW(), NOW()),
  ('purchaseOrders.delete', 'Delete Purchase Orders', 'Remove or cancel purchase orders', 1, 0, NOW(), NOW()),
  ('purchaseOrders.approve', 'Approve Purchase Orders', 'Approve purchase orders for processing', 1, 0, NOW(), NOW()),
  ('accountsPayable.view', 'View Accounts Payable', 'Allow users to view accounts payable', 1, 0, NOW(), NOW()),
  ('accountsPayable.update', 'Update Accounts Payable', 'Allow users to update accounts payable', 1, 0, NOW(), NOW()),
  ('payments.view', 'View Customer Payments', 'Allow users to view customer payments', 1, 0, NOW(), NOW()),
  ('payments.create', 'Create Customer Payments', 'Allow users to record customer payments', 1, 0, NOW(), NOW()),
  ('customerReturns.view', 'View Customer Returns', 'Allow users to view customer return records', 1, 0, NOW(), NOW()),
  ('customerReturns.create', 'Create Customer Returns', 'Allow users to record customer returns', 1, 0, NOW(), NOW()),
  ('customerReturns.update', 'Update Customer Returns', 'Allow users to update customer return details', 1, 0, NOW(), NOW()),
  ('customerReturns.approve', 'Approve Customer Returns', 'Allow users to approve or reject customer returns', 1, 0, NOW(), NOW()),
  ('customerReturns.delete', 'Delete Customer Returns', 'Allow users to archive customer returns', 1, 0, NOW(), NOW()),
  ('businessExpenses.view', 'View Business Expenses', 'Access expense records and recurring schedules', 1, 0, NOW(), NOW()),
  ('businessExpenses.create', 'Create Business Expenses', 'Record manual expenses and recurring schedules', 1, 0, NOW(), NOW()),
  ('businessExpenses.update', 'Update Business Expenses', 'Edit business expenses and recurring schedules', 1, 0, NOW(), NOW()),
  ('businessExpenses.delete', 'Delete Business Expenses', 'Remove business expenses and recurring schedules', 1, 0, NOW(), NOW()),
  ('payslips.view', 'View Payslips', 'Allow users to view payslips', 1, 0, NOW(), NOW()),
  ('payslips.create', 'Create Payslips', 'Allow users to create payslips', 1, 0, NOW(), NOW()),
  ('payslips.update', 'Update Payslips', 'Allow users to update payslips', 1, 0, NOW(), NOW()),
  ('payslips.delete', 'Delete Payslips', 'Allow users to delete payslips', 1, 0, NOW(), NOW()),
  ('settings.view', 'View Settings', 'Allow users to view tenant settings', 1, 0, NOW(), NOW()),
  ('settings.update', 'Update Settings', 'Allow users to update tenant settings', 1, 0, NOW(), NOW()),
  ('activityLogs.view', 'View Activity Logs', 'Allow users to view activity logs', 1, 0, NOW(), NOW())
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`),
  `status` = VALUES(`status`),
  `delete_flg` = VALUES(`delete_flg`),
  `updated_at` = NOW();

INSERT INTO `role_permissions` (`role`, `permission_id`)
SELECT 'owner', `id` FROM `permissions`
ON DUPLICATE KEY UPDATE `permission_id` = VALUES(`permission_id`);

INSERT INTO `role_permissions` (`role`, `permission_id`)
SELECT 'admin', `id` FROM `permissions`
WHERE `slug` NOT IN ('subscription.manage', 'tenant.subdomain.update')
ON DUPLICATE KEY UPDATE `permission_id` = VALUES(`permission_id`);

INSERT INTO `permissions` (`slug`, `name`, `description`, `status`, `delete_flg`, `created_at`, `updated_at`) VALUES
  ('assistant.query', 'Use Assistant', 'Allow users to query the assistant', 1, 0, NOW(), NOW())
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`),
  `updated_at` = NOW();

INSERT INTO `role_permissions` (`role`, `permission_id`)
SELECT 'admin', `id` FROM `permissions`
WHERE `slug` = 'assistant.query'
ON DUPLICATE KEY UPDATE `permission_id` = VALUES(`permission_id`);

INSERT INTO `role_permissions` (`role`, `permission_id`)
SELECT 'owner', `id` FROM `permissions`
WHERE `slug` = 'assistant.query'
ON DUPLICATE KEY UPDATE `permission_id` = VALUES(`permission_id`);
