-- Create default company for existing data
INSERT INTO companies (id, name, email, active, "createdAt") 
VALUES (1, 'Empresa Principal', '', true, NOW())
ON CONFLICT (id) DO NOTHING;

-- Set all existing records to companyId = 1
UPDATE users SET "companyId" = 1 WHERE "companyId" IS NULL OR "companyId" = 0;
UPDATE clients SET "companyId" = 1 WHERE "companyId" IS NULL OR "companyId" = 0;
UPDATE products SET "companyId" = 1 WHERE "companyId" IS NULL OR "companyId" = 0;
UPDATE opportunities SET "companyId" = 1 WHERE "companyId" IS NULL OR "companyId" = 0;
UPDATE quotes SET "companyId" = 1 WHERE "companyId" IS NULL OR "companyId" = 0;
UPDATE interactions SET "companyId" = 1 WHERE "companyId" IS NULL OR "companyId" = 0;
UPDATE sales SET "companyId" = 1 WHERE "companyId" IS NULL OR "companyId" = 0;

-- Set the first user as superadmin
UPDATE users SET role = 'superadmin' WHERE email = 'claudiolx.nunes@gmail.com';
