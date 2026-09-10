-- CreateTable: Phase 2 — Shop Configuration. See prisma/schema.prisma's
-- comment on ShopProfile for why this is a separate table from
-- Organization (Better Auth's own name/slug/logo fields aren't touched).
CREATE TABLE "ShopProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "logoKey" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "laborRate" DECIMAL(10,2),
    "diagnosticFee" DECIMAL(10,2),
    "taxRate" DECIMAL(5,2),
    "taxLabel" TEXT,
    "province" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopProfile_organizationId_key" ON "ShopProfile"("organizationId");

-- AddForeignKey
ALTER TABLE "ShopProfile" ADD CONSTRAINT "ShopProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
