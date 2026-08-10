const request = require('supertest');
const app = require('../app');
const { pool } = require('../config/db');

describe('Aadhaar & Admin-username login', () => {
  let adminToken;
  const testAadhaar = '999911112222'; // last4: 2222
  const testMobile = '9199999911';

  beforeAll(async () => {
    const res = await request(app).post('/api/auth/login-username').send({ identifier: 'Admin', password: 'Admin@123' });
    adminToken = res.body.data.accessToken;
  });

  afterAll(async () => {
    await pool.end();
  });

  it('logs the admin in with the literal "Admin" username', async () => {
    const res = await request(app).post('/api/auth/login-username').send({ identifier: 'Admin', password: 'Admin@123' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('ADMIN');
  });

  it('rejects an unknown Aadhaar last-4', async () => {
    const res = await request(app).post('/api/auth/check-aadhaar').send({ aadhaarLast4: '0000' });
    expect(res.status).toBe(401);
  });

  it('rejects a non-4-digit Aadhaar value', async () => {
    const res = await request(app).post('/api/auth/check-aadhaar').send({ aadhaarLast4: 'abcd' });
    expect(res.status).toBe(400);
  });

  it('walks a new member through first-time password setup then login', async () => {
    // Create a member with a known Aadhaar via the admin token
    const createRes = await request(app)
      .post('/api/members')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Jest Test Member', mobileNumber: testMobile, aadhaarNumber: testAadhaar });
    expect(createRes.status).toBe(201);

    const last4 = testAadhaar.slice(-4);

    const check1 = await request(app).post('/api/auth/check-aadhaar').send({ aadhaarLast4: last4 });
    expect(check1.status).toBe(200);
    expect(check1.body.data.needsPasswordSetup).toBe(true);

    const setPw = await request(app)
      .post('/api/auth/set-password-aadhaar')
      .send({ aadhaarLast4: last4, password: 'TestPass123' });
    expect(setPw.status).toBe(200);
    expect(setPw.body.data.user.role).toBe('MEMBER');

    const check2 = await request(app).post('/api/auth/check-aadhaar').send({ aadhaarLast4: last4 });
    expect(check2.body.data.needsPasswordSetup).toBe(false);

    // Immediate re-login must not collide (regression test for the jti fix)
    const loginRes = await request(app)
      .post('/api/auth/login-aadhaar')
      .send({ aadhaarLast4: last4, password: 'TestPass123' });
    expect(loginRes.status).toBe(200);

    const wrongPw = await request(app)
      .post('/api/auth/login-aadhaar')
      .send({ aadhaarLast4: last4, password: 'WrongPassword' });
    expect(wrongPw.status).toBe(401);
  });
});
