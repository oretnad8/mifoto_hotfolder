-- Shadow Database Permission Fix
-- Prisma needs to create a temporary "shadow database" during migrations.
-- We need to grant the user rights to create NEW databases.

-- Option 1: Grant global privileges (Recommended for local dev)
GRANT ALL PRIVILEGES ON *.* TO 'mifoto_user'@'localhost' WITH GRANT OPTION;

-- Apply changes
FLUSH PRIVILEGES;
