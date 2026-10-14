-- Custom CHECK constraints are intentional; preserve them in future table-rebuild migrations.
-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "opensOn" TEXT NOT NULL,
    "closesOn" TEXT NOT NULL,
    "announcement" TEXT NOT NULL DEFAULT '',
    "lifecycle" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Season_check_0" CHECK (lifecycle IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    CONSTRAINT "Season_check_1" CHECK (version >= 1),
    CONSTRAINT "Season_check_2" CHECK (length(opensOn) = 10 AND date(opensOn, '+0 days') IS NOT NULL AND date(opensOn, '+0 days') = opensOn),
    CONSTRAINT "Season_check_3" CHECK (length(closesOn) = 10 AND date(closesOn, '+0 days') IS NOT NULL AND date(closesOn, '+0 days') = closesOn),
    CONSTRAINT "Season_check_4" CHECK (opensOn <= closesOn)
);

-- CreateTable
CREATE TABLE "MerchandiseStyle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seasonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "cut" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MerchandiseStyle_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MerchandiseStyle_check_0" CHECK (cut IN ('classic', 'fitted', 'long')),
    CONSTRAINT "MerchandiseStyle_check_1" CHECK (typeof(unitPriceCents) = 'integer' AND unitPriceCents BETWEEN 0 AND 2147483647),
    CONSTRAINT "MerchandiseStyle_check_2" CHECK (version >= 1),
    CONSTRAINT "MerchandiseStyle_check_3" CHECK (position >= 0)
);

-- CreateTable
CREATE TABLE "StyleColor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "styleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "hex" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "StyleColor_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "MerchandiseStyle" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StyleColor_check_0" CHECK (version >= 1),
    CONSTRAINT "StyleColor_check_1" CHECK (position >= 0),
    CONSTRAINT "StyleColor_check_2" CHECK (length(hex) = 7 AND hex GLOB '#[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]')
);

-- CreateTable
CREATE TABLE "StyleSize" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "styleId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "normalizedLabel" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "StyleSize_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "MerchandiseStyle" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StyleSize_check_0" CHECK (version >= 1),
    CONSTRAINT "StyleSize_check_1" CHECK (position >= 0)
);

-- CreateTable
CREATE TABLE "ArtworkSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seasonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "frontAssetId" TEXT,
    "backAssetId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ArtworkSet_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ArtworkSet_frontAssetId_fkey" FOREIGN KEY ("frontAssetId") REFERENCES "Asset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ArtworkSet_backAssetId_fkey" FOREIGN KEY ("backAssetId") REFERENCES "Asset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ArtworkSet_check_0" CHECK (version >= 1),
    CONSTRAINT "ArtworkSet_check_1" CHECK (position >= 0)
);

-- CreateTable
CREATE TABLE "StyleArtworkSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "styleId" TEXT NOT NULL,
    "artworkSetId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    CONSTRAINT "StyleArtworkSet_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "MerchandiseStyle" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StyleArtworkSet_artworkSetId_fkey" FOREIGN KEY ("artworkSetId") REFERENCES "ArtworkSet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StyleArtworkSet_check_0" CHECK (position >= 0)
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mime" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Asset_check_0" CHECK (mime IN ('image/png', 'image/jpeg')),
    CONSTRAINT "Asset_check_1" CHECK (width > 0 AND height > 0 AND byteSize > 0)
);

-- CreateTable
CREATE TABLE "BlankPhoto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "styleId" TEXT NOT NULL,
    "colorId" TEXT,
    "side" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "BlankPhoto_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "MerchandiseStyle" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BlankPhoto_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "StyleColor" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BlankPhoto_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BlankPhoto_check_0" CHECK (side IN ('front', 'back')),
    CONSTRAINT "BlankPhoto_check_1" CHECK ((colorId IS NULL AND scopeKey = 'all') OR (colorId IS NOT NULL AND scopeKey = colorId)),
    CONSTRAINT "BlankPhoto_check_2" CHECK (version >= 1)
);

-- CreateTable
CREATE TABLE "Placement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "styleId" TEXT NOT NULL,
    "artworkSetId" TEXT NOT NULL,
    "colorId" TEXT,
    "side" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "x" REAL NOT NULL,
    "y" REAL NOT NULL,
    "width" REAL NOT NULL,
    "rotation" REAL NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "Placement_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "MerchandiseStyle" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Placement_artworkSetId_fkey" FOREIGN KEY ("artworkSetId") REFERENCES "ArtworkSet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Placement_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "StyleColor" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Placement_check_0" CHECK (side IN ('front', 'back')),
    CONSTRAINT "Placement_check_1" CHECK ((colorId IS NULL AND scopeKey = 'all') OR (colorId IS NOT NULL AND scopeKey = colorId)),
    CONSTRAINT "Placement_check_2" CHECK (version >= 1),
    CONSTRAINT "Placement_check_3" CHECK (x BETWEEN 0 AND 100 AND y BETWEEN 0 AND 100),
    CONSTRAINT "Placement_check_4" CHECK (width BETWEEN 5 AND 90),
    CONSTRAINT "Placement_check_5" CHECK (rotation BETWEEN -180 AND 180)
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "progress" TEXT NOT NULL DEFAULT 'OPEN',
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_check_0" CHECK (progress IN ('OPEN', 'DELIVERED_UNPAID', 'COMPLETE')),
    CONSTRAINT "Order_check_1" CHECK (cancelled IN (0, 1)),
    CONSTRAINT "Order_check_2" CHECK (version >= 1),
    CONSTRAINT "Order_check_3" CHECK (length(code) = 6 AND code NOT GLOB '*[^A-Z0-9]*')
);

-- CreateTable
CREATE TABLE "OrderLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "artworkSetId" TEXT NOT NULL,
    "colorId" TEXT NOT NULL,
    "sizeId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "styleName" TEXT NOT NULL,
    "artworkSetName" TEXT NOT NULL,
    "colorName" TEXT NOT NULL,
    "colorHex" TEXT NOT NULL,
    "sizeLabel" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    CONSTRAINT "OrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OrderLine_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "MerchandiseStyle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OrderLine_artworkSetId_fkey" FOREIGN KEY ("artworkSetId") REFERENCES "ArtworkSet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OrderLine_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "StyleColor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OrderLine_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "StyleSize" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OrderLine_check_0" CHECK (typeof(quantity) = 'integer' AND quantity BETWEEN 1 AND 2147483647),
    CONSTRAINT "OrderLine_check_1" CHECK (typeof(unitPriceCents) = 'integer' AND unitPriceCents BETWEEN 0 AND 2147483647),
    CONSTRAINT "OrderLine_check_2" CHECK (position >= 0)
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "csrfTokenHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    CONSTRAINT "Session_check_0" CHECK (role IN ('member', 'admin'))
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "responseJson" TEXT NOT NULL,
    "responseStatus" INTEGER NOT NULL,
    "orderId" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IdempotencyRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "IdempotencyRecord_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "IdempotencyRecord_check_0" CHECK (responseStatus BETWEEN 100 AND 599)
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    CONSTRAINT "RateLimitBucket_check_0" CHECK (count >= 0)
);

-- CreateTable
CREATE TABLE "InitializationMarker" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "MerchandiseStyle_seasonId_position_idx" ON "MerchandiseStyle"("seasonId", "position");

-- CreateIndex
CREATE INDEX "StyleColor_styleId_position_idx" ON "StyleColor"("styleId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "StyleColor_styleId_normalizedName_key" ON "StyleColor"("styleId", "normalizedName");

-- CreateIndex
CREATE INDEX "StyleSize_styleId_position_idx" ON "StyleSize"("styleId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "StyleSize_styleId_normalizedLabel_key" ON "StyleSize"("styleId", "normalizedLabel");

-- CreateIndex
CREATE UNIQUE INDEX "ArtworkSet_seasonId_normalizedName_key" ON "ArtworkSet"("seasonId", "normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "StyleArtworkSet_styleId_artworkSetId_key" ON "StyleArtworkSet"("styleId", "artworkSetId");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_storageKey_key" ON "Asset"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "BlankPhoto_styleId_side_scopeKey_key" ON "BlankPhoto"("styleId", "side", "scopeKey");

-- CreateIndex
CREATE UNIQUE INDEX "Placement_styleId_artworkSetId_side_scopeKey_key" ON "Placement"("styleId", "artworkSetId", "side", "scopeKey");

-- CreateIndex
CREATE UNIQUE INDEX "Order_code_key" ON "Order"("code");

-- CreateIndex
CREATE INDEX "Order_seasonId_fullName_code_idx" ON "Order"("seasonId", "fullName", "code");

-- CreateIndex
CREATE INDEX "OrderLine_orderId_position_idx" ON "OrderLine"("orderId", "position");

-- CreateIndex
CREATE INDEX "OrderLine_styleId_idx" ON "OrderLine"("styleId");

-- CreateIndex
CREATE INDEX "OrderLine_artworkSetId_idx" ON "OrderLine"("artworkSetId");

-- CreateIndex
CREATE INDEX "OrderLine_colorId_idx" ON "OrderLine"("colorId");

-- CreateIndex
CREATE INDEX "OrderLine_sizeId_idx" ON "OrderLine"("sizeId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_expiresAt_idx" ON "IdempotencyRecord"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_sessionId_key_key" ON "IdempotencyRecord"("sessionId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimitBucket_key_key" ON "RateLimitBucket"("key");

-- CreateIndex
CREATE INDEX "RateLimitBucket_expiresAt_idx" ON "RateLimitBucket"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "InitializationMarker_key_key" ON "InitializationMarker"("key");
