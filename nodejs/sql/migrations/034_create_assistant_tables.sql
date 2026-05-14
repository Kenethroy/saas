USE `jrspc_node`;

-- Assistant Queries table
CREATE TABLE IF NOT EXISTS `assistant_queries` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NULL,
    `question` TEXT NOT NULL,
    `answer` TEXT NULL,
    `mode` VARCHAR(50) NOT NULL,
    `confidence` VARCHAR(20) NULL,
    `intent` VARCHAR(100) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'success',
    `provider` VARCHAR(100) NULL,
    `model` VARCHAR(100) NULL,
    `context` JSON NULL,
    `sources` JSON NULL,
    `error_message` TEXT NULL,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` VARCHAR(255) NULL,
    `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_assistant_queries_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX `idx_assistant_queries_user_id` ON `assistant_queries` (`user_id`);
CREATE INDEX `idx_assistant_queries_status` ON `assistant_queries` (`status`);
CREATE INDEX `idx_assistant_queries_intent` ON `assistant_queries` (`intent`);
CREATE INDEX `idx_assistant_queries_created_at` ON `assistant_queries` (`created_at`);

-- Assistant Index Documents table
CREATE TABLE IF NOT EXISTS `assistant_index_documents` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `document_key` VARCHAR(191) NOT NULL,
    `source_type` VARCHAR(50) NOT NULL,
    `module` VARCHAR(100) NOT NULL,
    `entity_type` VARCHAR(50) NOT NULL,
    `entity_id` BIGINT UNSIGNED NULL,
    `title` VARCHAR(255) NOT NULL,
    `content` TEXT NOT NULL,
    `metadata` JSON NULL,
    `last_indexed_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
    `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_assistant_index_documents_key` (`document_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX `idx_assistant_index_documents_module` ON `assistant_index_documents` (`module`);
CREATE INDEX `idx_assistant_index_documents_entity_type` ON `assistant_index_documents` (`entity_type`);
CREATE INDEX `idx_assistant_index_documents_entity_id` ON `assistant_index_documents` (`entity_id`);
CREATE INDEX `idx_assistant_index_documents_source_type` ON `assistant_index_documents` (`source_type`);

-- Assistant Index Chunks table
CREATE TABLE IF NOT EXISTS `assistant_index_chunks` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `document_id` BIGINT UNSIGNED NOT NULL,
    `chunk_index` INTEGER NOT NULL,
    `content` TEXT NOT NULL,
    `keywords` TEXT NULL,
    `embedding` JSON NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_assistant_index_chunks_document_chunk` (`document_id`, `chunk_index`),
    CONSTRAINT `fk_assistant_index_chunks_document` FOREIGN KEY (`document_id`) REFERENCES `assistant_index_documents` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX `idx_assistant_index_chunks_document_id` ON `assistant_index_chunks` (`document_id`);
