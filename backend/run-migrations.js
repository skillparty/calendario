const fs = require('fs');
const path = require('path');
const { query, testConnection } = require('./utils/db.js');
const logger = require('./utils/logger.js');

async function runMigrations() {
  try {
    // Test database connection
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Database connection failed');
    }

    console.log('🔄 Running database migrations...');

    // Create migrations table if it doesn't exist
    await query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get list of migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    // Get already executed migrations
    const executedResult = await query('SELECT filename FROM migrations');
    const executedMigrations = executedResult.rows.map(row => row.filename);

    // Execute pending migrations
    for (const filename of migrationFiles) {
      if (executedMigrations.includes(filename)) {
        console.log(`⏭️  Skipping ${filename} (already executed)`);
        continue;
      }

      console.log(`🔄 Executing migration: ${filename}`);
      
      const filePath = path.join(migrationsDir, filename);
      const migrationSQL = fs.readFileSync(filePath, 'utf8');

      try {
        await query('BEGIN');
        
        // Execute the migration
        await query(migrationSQL);
        
        // Record the migration as executed
        await query(
          'INSERT INTO migrations (filename) VALUES ($1)',
          [filename]
        );
        
        await query('COMMIT');
        console.log(`✅ Migration ${filename} executed successfully`);
        
      } catch (error) {
        await query('ROLLBACK');
        console.error(`❌ Migration ${filename} failed:`, error);
        throw error;
      }
    }

    console.log('✅ All migrations completed successfully');
    
  } catch (error) {
    console.error('❌ Migration process failed:', error);
    process.exit(1);
  }
}

// Run migrations if this script is executed directly
if (require.main === module) {
  runMigrations().then(() => {
    console.log('🎉 Migration process completed');
    process.exit(0);
  });
}

module.exports = { runMigrations };
