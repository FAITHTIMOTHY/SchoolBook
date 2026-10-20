-- SchoolBook SMS - PostgreSQL Database Schema
-- Provides multi-tenant logical isolation and relational structure for academic institutions

-- 1. Tenants Table (Logical School / Campus separation on the same server)
CREATE TABLE tenants (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    logo_url VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Units Table (Academic Faculties, Departments & Class Cohorts)
CREATE TABLE units (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    parent_unit_id VARCHAR(50) REFERENCES units(id) ON DELETE SET NULL, -- Deans can create sub-departments
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_unit_per_tenant UNIQUE (tenant_id, name)
);

-- 3. Members Table (All students, faculty, and school administrators)
CREATE TABLE members (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE,
    phone VARCHAR(20),
    address TEXT,
    profile_picture_url VARCHAR(255),
    dob_month INT CHECK (dob_month BETWEEN 1 AND 12), -- Year excluded from student profile requirements
    dob_day INT CHECK (dob_day BETWEEN 1 AND 31),
    role VARCHAR(50) NOT NULL CHECK (role IN ('Principal', 'Dean', 'Teacher', 'Counselor', 'Student')),
    position VARCHAR(100), -- e.g., "Principal", "Dean of Science", "Senior STEM Instructor"
    unit_id VARCHAR(50) REFERENCES units(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    joined_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Attendance Table (Linked directly to student & faculty academic records)
CREATE TABLE attendance (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    member_id VARCHAR(50) NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    service_date DATE NOT NULL, -- Session Date (YYYY-MM-DD)
    service_name VARCHAR(100) NOT NULL, -- e.g., "Morning Roll Call", "Period 1 - STEM Lecture"
    status VARCHAR(20) NOT NULL CHECK (status IN ('Present', 'Absent')),
    recorded_by VARCHAR(50) REFERENCES members(id) ON DELETE SET NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_member_attendance_per_service UNIQUE (tenant_id, member_id, service_date, service_name)
);

-- 5. Inventory Table (Campus equipment, STEM labs, athletic gear, and library resources)
CREATE TABLE inventory (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    item_name VARCHAR(150) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Faulty', 'Unavailable')),
    unit_id VARCHAR(50) REFERENCES units(id) ON DELETE SET NULL, -- Department responsible (STEM Lab, Athletics, etc.)
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Financials Table (Secure tuition, lab fees, PTA dues, and scholarship ledger)
CREATE TABLE financials (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    member_id VARCHAR(50) REFERENCES members(id) ON DELETE SET NULL, -- Student or Sponsor
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    category VARCHAR(50) NOT NULL CHECK (category IN ('Tuition', 'Lab & Library Fees', 'PTA & Extracurricular', 'Donations')),
    payment_method VARCHAR(50) NOT NULL, -- Card, Bank Transfer, Cash
    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    recorded_by VARCHAR(50) REFERENCES members(id) ON DELETE SET NULL
);

-- Add indexations for multi-tenant query acceleration and role access validation
CREATE INDEX idx_members_tenant ON members(tenant_id);
CREATE INDEX idx_attendance_tenant ON attendance(tenant_id);
CREATE INDEX idx_inventory_tenant ON inventory(tenant_id);
CREATE INDEX idx_financials_tenant ON financials(tenant_id);
CREATE INDEX idx_units_tenant ON units(tenant_id);
