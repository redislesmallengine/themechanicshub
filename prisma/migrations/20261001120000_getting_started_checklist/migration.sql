-- Dashboard "Getting Started" checklist dismiss flag -- shop-wide, not per-user.
ALTER TABLE "ShopProfile" ADD COLUMN "gettingStartedDismissed" BOOLEAN NOT NULL DEFAULT false;
