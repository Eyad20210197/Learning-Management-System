/*
  Warnings:

  - Added the required column `filename` to the `lesson_resources` table without a default value. This is not possible if the table is not empty.
  - Added the required column `initiated_by_user_id` to the `lesson_resources` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "lesson_resource_status" AS ENUM ('PENDING', 'READY', 'EXPIRED');

-- AlterTable
ALTER TABLE "lesson_resources" ADD COLUMN     "expires_at" TIMESTAMPTZ(6),
ADD COLUMN     "filename" TEXT NOT NULL,
ADD COLUMN     "initiated_by_user_id" UUID NOT NULL,
ADD COLUMN     "status" "lesson_resource_status" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "lesson_resources_status_expires_at_idx" ON "lesson_resources"("status", "expires_at");

-- AddForeignKey
ALTER TABLE "lesson_resources" ADD CONSTRAINT "lesson_resources_initiated_by_user_id_fkey" FOREIGN KEY ("initiated_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
