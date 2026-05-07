-- CreateTable
CREATE TABLE `FindameetingAccessLog` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `callerHash` VARCHAR(32) NOT NULL,
    `outcome` VARCHAR(64) NOT NULL,
    `phoneRaw` VARCHAR(255) NULL,
    `note` VARCHAR(512) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `FindameetingAccessLog_createdAt_idx` ON `FindameetingAccessLog`(`createdAt`);
