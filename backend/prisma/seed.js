require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../src/config/db');

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const adminHash = await bcrypt.hash('Admin@123', 12);
    const adminResult = await client.query(
      `INSERT INTO users (phone, email, password_hash, role)
       VALUES ('9000000001', 'admin@jfc.local', $1, 'ADMIN')
       ON CONFLICT (phone) DO NOTHING RETURNING id`,
      [adminHash]
    );
    if (adminResult.rows[0]) {
      await client.query(
        `INSERT INTO members (user_id, name, mobile_number, whatsapp_number, email)
         VALUES ($1, 'Senthil Prabu (Admin)', '9000000001', '9000000001', 'admin@jfc.local')`,
        [adminResult.rows[0].id]
      );
      console.log('Created admin user: phone=9000000001 password=Admin@123');
    } else {
      console.log('Admin user already exists, skipping.');
    }

    const managerHash = await bcrypt.hash('Manager@123', 12);
    await client.query(
      `INSERT INTO users (phone, email, password_hash, role)
       VALUES ('9000000002', 'manager@jfc.local', $1, 'MANAGER')
       ON CONFLICT (phone) DO NOTHING`,
      [managerHash]
    );

    const sampleMembers = [
      ['Karthik Raja', '9000000010'],
      ['Deepa Suresh', '9000000011'],
      ['Vignesh Kumar', '9000000012'],
      ['Priya Anand', '9000000013'],
    ];
    for (const [name, mobile] of sampleMembers) {
      await client.query(
        `INSERT INTO members (name, mobile_number, whatsapp_number)
         VALUES ($1, $2, $2) ON CONFLICT (mobile_number) DO NOTHING`,
        [name, mobile]
      );
    }

    await client.query(
      `INSERT INTO chits (ref_number, name, chit_value, total_months, monthly_installment, commission_percent, status)
       VALUES ('JFC-CHIT-2026-01', 'JFC Friends Chit - Batch 1', 400000, 4, 100000, 5.00, 'DRAFT')
       ON CONFLICT (ref_number) DO NOTHING`
    );

    await client.query('COMMIT');
    console.log('Seed complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
