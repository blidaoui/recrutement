-- AlterTable
ALTER TABLE "Message"
ADD COLUMN "attachmentType" TEXT DEFAULT 'TEXT',
ADD COLUMN "attachmentUrl" TEXT,
ADD COLUMN "attachmentName" TEXT,
ADD COLUMN "mimeType" TEXT;