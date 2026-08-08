const request = require('supertest');
const app = require('../app');
const { pool } = require('../config/db');

describe('Auth API', () => {
  afterAll(async () => {
    await pool.end();
  });

  it('rejects login with wrong credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ phone: '9000000001', password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('logs in with correct seeded admin credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ phone: '9000000001', password: 'Admin@123' });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.role).toBe('ADMIN');
  });

  it('rejects requests to protected routes without a token', async () => {
    const res = await request(app).get('/api/members');
    expect(res.status).toBe(401);
  });

  it('validates required fields on login', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
    expect(res.body.details).toBeDefined();
  });
});
