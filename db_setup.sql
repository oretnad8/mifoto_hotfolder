-- Create User and Grant Permissions
-- Change 'secure_password_123' to a strong password of your choice
CREATE USER IF NOT EXISTS 'mifoto_user'@'localhost' IDENTIFIED BY 'secure_password_123';
GRANT ALL PRIVILEGES ON mifotovalidador.* TO 'mifoto_user'@'localhost';
FLUSH PRIVILEGES;

-- Schema Definition (Equivalent to what Prisma will generate)
USE mifotovalidador;

CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(191) PRIMARY KEY,
    client JSON NOT NULL, -- Stores name, email, etc.
    payment_method VARCHAR(50) NOT NULL, -- 'card', 'transfer'
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'validated'
    payment_reference VARCHAR(191),
    total DOUBLE NOT NULL,
    items JSON NOT NULL, -- Stores the photo details
    files_copied BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
);
