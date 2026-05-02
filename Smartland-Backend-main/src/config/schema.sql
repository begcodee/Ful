DROP TABLE IF EXISTS disputes CASCADE;
DROP TABLE IF EXISTS land_transfers CASCADE;
DROP TABLE IF EXISTS lands CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  national_id VARCHAR(50),
  role VARCHAR(50) NOT NULL DEFAULT 'landowner',
  verification_status VARCHAR(50) NOT NULL DEFAULT 'pending',
  country VARCHAR(10) DEFAULT 'GH',
  phone_number VARCHAR(50),
  organization VARCHAR(255),
  wallet_address VARCHAR(255),
  profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  reputation JSONB NOT NULL DEFAULT '{}'::jsonb,
  joined_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lands (
  id SERIAL PRIMARY KEY,
  land_name VARCHAR(255) NOT NULL,
  location VARCHAR(255) NOT NULL,
  size DECIMAL(10, 2) NOT NULL,
  coordinates JSONB,
  owner_id INTEGER NOT NULL,
  land_type VARCHAR(100),
  description TEXT,
  estimated_value DECIMAL(12, 2) DEFAULT 0,
  documents JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  blockchain_hash VARCHAR(255),
  last_transfer TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS land_transfers (
  id SERIAL PRIMARY KEY,
  land_id INTEGER NOT NULL,
  from_owner_id INTEGER NOT NULL,
  to_owner_id INTEGER NOT NULL,
  amount DECIMAL(12, 2) DEFAULT 0,
  transfer_reason TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'escrowed',
  escrow_hash VARCHAR(255),
  initiated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_date TIMESTAMP,
  transfer_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (land_id) REFERENCES lands(id) ON DELETE CASCADE,
  FOREIGN KEY (from_owner_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (to_owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS disputes (
  id SERIAL PRIMARY KEY,
  land_id INTEGER NOT NULL,
  plaintiff_name VARCHAR(255) NOT NULL,
  defendant_name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  resolution TEXT,
  votes JSONB NOT NULL DEFAULT '{"support":0,"against":0,"abstain":0}'::jsonb,
  arbitrator VARCHAR(255),
  filed_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (land_id) REFERENCES lands(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS votes (
  id SERIAL PRIMARY KEY,
  dispute_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  vote_type VARCHAR(20) NOT NULL CHECK (vote_type IN ('support', 'against', 'abstain')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_votes_dispute_user UNIQUE (dispute_id, user_id),
  FOREIGN KEY (dispute_id) REFERENCES disputes(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lands_owner_id ON lands(owner_id);
CREATE INDEX IF NOT EXISTS idx_lands_location ON lands(location);
CREATE INDEX IF NOT EXISTS idx_land_transfers_land_id ON land_transfers(land_id);
CREATE INDEX IF NOT EXISTS idx_land_transfers_from_owner ON land_transfers(from_owner_id);
CREATE INDEX IF NOT EXISTS idx_land_transfers_to_owner ON land_transfers(to_owner_id);
CREATE INDEX IF NOT EXISTS idx_disputes_land_id ON disputes(land_id);
CREATE INDEX IF NOT EXISTS idx_votes_dispute_id ON votes(dispute_id);
CREATE INDEX IF NOT EXISTS idx_votes_user_id ON votes(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

INSERT INTO users (
  full_name, email, password, national_id, role, verification_status, country, phone_number, organization, wallet_address, profile, reputation
) VALUES
(
  'Kwame Asante',
  'kwame.asante@gmail.com',
  'demo123',
  'GHA-001',
  'landowner',
  'verified',
  'GH',
  '+233244123456',
  NULL,
  '0x1111111111111111111111111111111111111111',
  '{"phone":"+233244123456","address":"12 East Legon Road","city":"Accra","state":"Greater Accra","country":"GH","postalCode":"GA-123-4567","dateOfBirth":"1990-05-17","nationalId":"GHA-001","bio":"Landowner managing residential properties in Accra.","avatar":""}'::jsonb,
  '{"score":95,"totalTransactions":12,"successfulTransactions":11,"disputesWon":2,"disputesLost":1,"communityVotes":45,"lastUpdated":"2026-03-01T00:00:00Z"}'::jsonb
),
(
  'Akosua Frimpong',
  'akosua.frimpong@yahoo.com',
  'demo123',
  'GHA-002',
  'buyer',
  'verified',
  'GH',
  '+233201987654',
  NULL,
  '0x2222222222222222222222222222222222222222',
  '{"phone":"+233201987654","address":"44 Adum High Street","city":"Kumasi","state":"Ashanti","country":"GH","postalCode":"AK-210-8891","dateOfBirth":"1993-09-08","nationalId":"GHA-002","bio":"Investor interested in commercial land opportunities.","avatar":""}'::jsonb,
  '{"score":88,"totalTransactions":8,"successfulTransactions":8,"disputesWon":1,"disputesLost":0,"communityVotes":32,"lastUpdated":"2026-03-01T00:00:00Z"}'::jsonb
),
(
  'Ghana Land Commission',
  'admin@ghanalandcommission.gov.gh',
  'demo123',
  'GOV-001',
  'authority',
  'verified',
  'GH',
  '+233302123456',
  'Ghana Land Commission',
  '0x3333333333333333333333333333333333333333',
  '{"phone":"+233302123456","address":"Accra Central Government Offices","city":"Accra","state":"Greater Accra","country":"GH","postalCode":"GA-000-1000","dateOfBirth":"2000-01-01","nationalId":"GOV-001","bio":"Official registry authority account.","avatar":""}'::jsonb,
  '{"score":100,"totalTransactions":0,"successfulTransactions":0,"disputesWon":0,"disputesLost":0,"communityVotes":0,"lastUpdated":"2026-03-01T00:00:00Z"}'::jsonb
),
(
  'Dr. Ama Osei',
  'ama.osei@arbitrator.gh',
  'demo123',
  'ARB-001',
  'arbitrator',
  'verified',
  'GH',
  '+233244111222',
  'Ghana Bar Association',
  '0x4444444444444444444444444444444444444444',
  '{"phone":"+233244111222","address":"Ridge, Accra","city":"Accra","state":"Greater Accra","country":"GH","postalCode":"GA-555-1212","dateOfBirth":"1985-02-14","nationalId":"ARB-001","bio":"Independent arbitrator specializing in land disputes.","avatar":""}'::jsonb,
  '{"score":98,"totalTransactions":0,"successfulTransactions":0,"disputesWon":15,"disputesLost":0,"communityVotes":120,"lastUpdated":"2026-03-01T00:00:00Z"}'::jsonb
);

INSERT INTO lands (
  land_name, location, size, coordinates, owner_id, land_type, description, estimated_value, documents, status, blockchain_hash, last_transfer
) VALUES
(
  'Residential Plot - East Legon',
  'East Legon, Accra, Greater Accra Region',
  1200,
  '{"lat":5.6037,"lng":-0.1870}'::jsonb,
  1,
  'residential',
  'Prime residential land in East Legon with easy access to main roads and utilities.',
  85000,
  '["title_deed.pdf","survey_plan.pdf","building_permit.pdf"]'::jsonb,
  'active',
  '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  CURRENT_TIMESTAMP
),
(
  'Commercial Land - Kumasi CBD',
  'Adum, Kumasi, Ashanti Region',
  2500,
  '{"lat":6.6885,"lng":-1.6244}'::jsonb,
  2,
  'commercial',
  'Strategic commercial land in Kumasi business district.',
  120000,
  '["commercial_title.pdf","zoning_certificate.pdf"]'::jsonb,
  'transfer_pending',
  '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  CURRENT_TIMESTAMP
),
(
  'Coastal Tourism Land - Cape Coast',
  'Cape Coast, Central Region',
  800,
  '{"lat":5.1053,"lng":-1.2466}'::jsonb,
  1,
  'tourism',
  'Beautiful coastal land with tourism potential near Cape Coast Castle.',
  95000,
  '["coastal_title.pdf","environmental_clearance.pdf"]'::jsonb,
  'disputed',
  '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
  CURRENT_TIMESTAMP
);

INSERT INTO land_transfers (
  land_id, from_owner_id, to_owner_id, amount, transfer_reason, status, escrow_hash, initiated_date, completed_date
) VALUES
(
  2,
  2,
  3,
  120000,
  'Commercial sale agreement',
  'escrowed',
  '0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
  CURRENT_TIMESTAMP - INTERVAL '5 days',
  NULL
),
(
  1,
  3,
  1,
  85000,
  'Prior ownership transfer',
  'completed',
  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  CURRENT_TIMESTAMP - INTERVAL '30 days',
  CURRENT_TIMESTAMP - INTERVAL '25 days'
);

INSERT INTO disputes (
  land_id, plaintiff_name, defendant_name, description, evidence, status, resolution, votes, arbitrator, filed_date
) VALUES
(
  3,
  'Traditional Authority - Cape Coast',
  'Kwame Asante',
  'Dispute over traditional land rights and proper acquisition procedures for coastal land development.',
  '["traditional_claim.pdf","witness_statements.pdf","historical_documents.pdf"]'::jsonb,
  'community_voting',
  NULL,
  '{"support":23,"against":18,"abstain":5}'::jsonb,
  'Dr. Ama Osei',
  CURRENT_TIMESTAMP - INTERVAL '7 days'
),
(
  1,
  'John Mensah',
  'Kwame Asante',
  'Claim of prior ownership and incomplete transfer documentation.',
  '["prior_agreement.pdf","payment_receipts.pdf"]'::jsonb,
  'resolved',
  'Resolved in favor of defendant. Original documentation confirmed valid ownership transfer.',
  '{"support":12,"against":5,"abstain":2}'::jsonb,
  'Dr. Ama Osei',
  CURRENT_TIMESTAMP - INTERVAL '20 days'
);
