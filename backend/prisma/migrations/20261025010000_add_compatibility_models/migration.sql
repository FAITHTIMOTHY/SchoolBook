-- CreateEnum
CREATE TYPE "ServiceAttendanceStatus" AS ENUM ('PRESENT', 'ABSENT');

-- CreateEnum
CREATE TYPE "InventoryStatus" AS ENUM ('ACTIVE', 'FAULTY', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "FinanceCategory" AS ENUM ('TUITION', 'LAB_LIBRARY', 'PTA_EXTRACURRICULAR', 'DONATIONS');

-- CreateTable
CREATE TABLE "ServiceAttendance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "memberKind" TEXT NOT NULL,
    "serviceDate" DATE NOT NULL,
    "serviceName" TEXT NOT NULL,
    "status" "ServiceAttendanceStatus" NOT NULL DEFAULT 'ABSENT',
    "recordedById" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" "InventoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "unitId" TEXT,
    "unitKind" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceTransaction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "memberId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "category" "FinanceCategory" NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Broadcast" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "target" TEXT NOT NULL DEFAULT 'all',
    "unitId" TEXT,
    "category" TEXT NOT NULL DEFAULT 'impromptu',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "eventDate" DATE,
    "attachment" JSONB,
    "bulkMailed" BOOLEAN NOT NULL DEFAULT false,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Broadcast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentPortal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "gradeLevel" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL DEFAULT 75,
    "term" TEXT NOT NULL,
    "grades" JSONB NOT NULL DEFAULT '[]',
    "teacherRemarks" TEXT NOT NULL DEFAULT '',
    "guardianName" TEXT NOT NULL DEFAULT '',
    "guardianEmail" TEXT NOT NULL DEFAULT '',
    "guardianPhone" TEXT NOT NULL DEFAULT '',
    "guardianRelation" TEXT NOT NULL DEFAULT 'Parent/Guardian',
    "syllabusAttachments" JSONB NOT NULL DEFAULT '[]',
    "lastUpdatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentPortal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceAttendance_tenantId_serviceDate_serviceName_idx" ON "ServiceAttendance"("tenantId", "serviceDate", "serviceName");

-- CreateIndex
CREATE INDEX "ServiceAttendance_memberId_idx" ON "ServiceAttendance"("memberId");

-- CreateIndex
CREATE INDEX "ServiceAttendance_recordedById_idx" ON "ServiceAttendance"("recordedById");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceAttendance_tenantId_memberId_serviceDate_serviceName_key" ON "ServiceAttendance"("tenantId", "memberId", "serviceDate", "serviceName");

-- CreateIndex
CREATE INDEX "InventoryItem_tenantId_idx" ON "InventoryItem"("tenantId");

-- CreateIndex
CREATE INDEX "InventoryItem_unitId_idx" ON "InventoryItem"("unitId");

-- CreateIndex
CREATE INDEX "InventoryItem_status_idx" ON "InventoryItem"("status");

-- CreateIndex
CREATE INDEX "FinanceTransaction_tenantId_transactionDate_idx" ON "FinanceTransaction"("tenantId", "transactionDate");

-- CreateIndex
CREATE INDEX "FinanceTransaction_memberId_idx" ON "FinanceTransaction"("memberId");

-- CreateIndex
CREATE INDEX "FinanceTransaction_recordedById_idx" ON "FinanceTransaction"("recordedById");

-- CreateIndex
CREATE INDEX "FinanceTransaction_category_idx" ON "FinanceTransaction"("category");

-- CreateIndex
CREATE INDEX "Broadcast_tenantId_sentAt_idx" ON "Broadcast"("tenantId", "sentAt");

-- CreateIndex
CREATE INDEX "Broadcast_unitId_idx" ON "Broadcast"("unitId");

-- CreateIndex
CREATE INDEX "Broadcast_senderId_idx" ON "Broadcast"("senderId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentPortal_studentId_key" ON "StudentPortal"("studentId");

-- CreateIndex
CREATE INDEX "StudentPortal_tenantId_idx" ON "StudentPortal"("tenantId");

-- CreateIndex
CREATE INDEX "StudentPortal_lastUpdatedById_idx" ON "StudentPortal"("lastUpdatedById");

-- CreateIndex
CREATE UNIQUE INDEX "StudentPortal_tenantId_studentId_key" ON "StudentPortal"("tenantId", "studentId");

-- AddForeignKey
ALTER TABLE "ServiceAttendance" ADD CONSTRAINT "ServiceAttendance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceAttendance" ADD CONSTRAINT "ServiceAttendance_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPortal" ADD CONSTRAINT "StudentPortal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPortal" ADD CONSTRAINT "StudentPortal_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPortal" ADD CONSTRAINT "StudentPortal_lastUpdatedById_fkey" FOREIGN KEY ("lastUpdatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
