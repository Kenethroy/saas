USE `jrspc_node`;

ALTER TABLE `payslips`
  ADD COLUMN `overtime_pay` DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER `gross_pay`;

-- Backfill from metadata if present (for environments where overtime was stored in JSON)
UPDATE `payslips`
SET `overtime_pay` = CAST(
  JSON_UNQUOTE(JSON_EXTRACT(`metadata`, '$.overtime_pay')) AS DECIMAL(15,2)
)
WHERE `metadata` IS NOT NULL
  AND JSON_EXTRACT(`metadata`, '$.overtime_pay') IS NOT NULL
  AND `overtime_pay` = 0;

