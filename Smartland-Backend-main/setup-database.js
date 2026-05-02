import pkg from "pg";
const { Pool } = pkg;
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync } from "fs";

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function setupDatabase() {
  const client = await pool.connect();
  
  try {
    console.log("🔗 Connecting to PostgreSQL...");
    
    // Read the schema file
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const schemaPath = join(__dirname, "src", "config", "schema.sql");
    const schema = readFileSync(schemaPath, "utf8");
    
    console.log("📝 Running database schema...");
    
    // Execute the schema in a transaction
    await client.query('BEGIN');
    await client.query(schema);
    await client.query('COMMIT');
    
    console.log("✅ Database setup completed successfully!");
    console.log("\nCreated tables:");
    console.log("  - users");
    console.log("  - lands");
    console.log("  - land_transfers");
    console.log("\nYour API is ready to use! 🚀");
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("❌ Error setting up database:");
    console.error(error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

setupDatabase();
