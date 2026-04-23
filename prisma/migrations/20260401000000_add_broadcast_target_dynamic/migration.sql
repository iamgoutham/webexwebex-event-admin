-- AlterEnum: add DYNAMIC to Broadcast.target (MySQL)
ALTER TABLE `Broadcast` MODIFY `target` ENUM('HOSTS_ONLY', 'PARTICIPANTS_ONLY', 'ALL', 'DYNAMIC') NOT NULL;
