-- Who may open Configuration -> Email. Off for everyone by default; switched on by hand, like User.isSiteAdmin.
ALTER TABLE "User" ADD COLUMN "canConfigureEmail" BOOLEAN NOT NULL DEFAULT false;
