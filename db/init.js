const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

async function initializeDatabase() {
  try {
    console.log('🔄 Connecting to NeonDB and creating tables...');
    const schemaPath = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    await pool.query(sql);
    console.log('✅ Database schema applied successfully! Tables `campaigns` and `recipients` are ready.');
  } catch (error) {
    console.error('❌ Failed to initialize database schema:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initializeDatabase();
