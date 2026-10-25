-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "unitId" TEXT;

-- CreateIndex
CREATE INDEX "Student_unitId_idx" ON "Student"("unitId");
