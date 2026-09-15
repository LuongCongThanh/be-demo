/*
  Warnings:

  - Made the column `full_name` on table `users` required. This step will fail if there are existing NULL values in that column.
  - Made the column `phone` on table `users` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "users" ALTER COLUMN "full_name" SET NOT NULL,
ALTER COLUMN "phone" SET NOT NULL;
