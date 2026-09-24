const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;
let serverInstance;
const PORT = 5055;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function runTests() {
  console.log('🚀 Starting Gym API Automated Tests...\n');

  mongoServer = await MongoMemoryServer.create({
    binary: { version: '8.2.6' }
  });
  const mongoUri = mongoServer.getUri();
  process.env.MONGODB_URI = mongoUri;
  process.env.PORT = PORT;
  process.env.SESSION_SECRET = 'test_secret_key_2026';

  const { app, server } = require('../server');
  serverInstance = server;
  await new Promise((resolve) => setTimeout(resolve, 500));

  async function request(endpoint, options = {}, cookie = '') {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (cookie) headers['Cookie'] = cookie;

    const res = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers
    });

    const setCookieHeader = res.headers.get('set-cookie');
    const newCookie = setCookieHeader ? setCookieHeader.split(';')[0] : cookie;
    let data;
    try {
      data = await res.json();
    } catch (e) {
      data = null;
    }

    return { status: res.status, data, cookie: newCookie };
  }

  try {
    // -------------------------------------------------------------
    // Test 1: Register member & verify 30-day expiry calculation
    // -------------------------------------------------------------
    console.log('Test 1: Member Registration & Expiry Date Calculation...');
    const nowBeforeReg = Date.now();
    const regRes = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        username: 'fit_sam',
        email: 'sam@fit.com',
        password: 'mypassword',
        membershipTier: 'Gold',
        durationMonths: 1
      })
    });

    assert.strictEqual(regRes.status, 201, `Expected 201 Created, got ${regRes.status}`);
    assert.strictEqual(regRes.data.user.username, 'fit_sam');
    assert.strictEqual(regRes.data.user.membershipTier, 'Gold');
    assert.strictEqual(regRes.data.user.membershipStatus, 'active');

    const expiryDate = new Date(regRes.data.user.membershipExpiryDate).getTime();
    const expectedExpiry = nowBeforeReg + (30 * 24 * 60 * 60 * 1000);
    const diffSeconds = Math.abs(expiryDate - expectedExpiry) / 1000;
    assert(diffSeconds < 5, `Expiry date should be ~30 days in future. Diff: ${diffSeconds}s`);
    const samCookie = regRes.cookie;
    console.log('✅ Passed Test 1: Registered member with 30-day calculated expiry date.');

    // -------------------------------------------------------------
    // Test 2: Fetch Active Member Profile & Remaining Days
    // -------------------------------------------------------------
    console.log('\nTest 2: Fetch Active Member Profile (/api/auth/me)...');
    const meRes = await request('/api/auth/me', { method: 'GET' }, samCookie);
    assert.strictEqual(meRes.status, 200, `Expected 200 OK, got ${meRes.status}`);
    assert.strictEqual(meRes.data.user.username, 'fit_sam');
    assert.strictEqual(meRes.data.remainingDays, 30, `Expected remainingDays = 30, got ${meRes.data.remainingDays}`);
    console.log('✅ Passed Test 2: Profile retrieved with accurate remainingDays calculation.');

    // -------------------------------------------------------------
    // Test 3: Create Fitness Class (maxCapacity = 2)
    // -------------------------------------------------------------
    console.log('\nTest 3: Create Fitness Class...');
    const createClassRes = await request('/api/classes', {
      method: 'POST',
      body: JSON.stringify({
        title: 'HIIT Bootcamp',
        trainerName: 'Maria',
        scheduleDate: '2026-04-15T09:00:00Z',
        maxCapacity: 2
      })
    });

    assert.strictEqual(createClassRes.status, 201, `Expected 201 Created, got ${createClassRes.status}`);
    const classId = createClassRes.data.fitnessClass._id;
    assert.strictEqual(createClassRes.data.fitnessClass.maxCapacity, 2);
    console.log('✅ Passed Test 3: Created fitness class with maxCapacity = 2.');

    // -------------------------------------------------------------
    // Test 4: Capacity Limit Enforcement (3rd booking fails)
    // -------------------------------------------------------------
    console.log('\nTest 4: Class Capacity Constraint (Booking 3 members into capacity=2 class)...');
    
    const m1Reg = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username: 'member1', email: 'm1@test.com', password: 'password123', durationMonths: 1 })
    });
    const book1Res = await request(`/api/classes/${classId}/book`, { method: 'POST' }, m1Reg.cookie);
    assert.strictEqual(book1Res.status, 200, `Member 1 booking failed: ${JSON.stringify(book1Res.data)}`);

    const m2Reg = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username: 'member2', email: 'm2@test.com', password: 'password123', durationMonths: 1 })
    });
    const book2Res = await request(`/api/classes/${classId}/book`, { method: 'POST' }, m2Reg.cookie);
    assert.strictEqual(book2Res.status, 200, `Member 2 booking failed: ${JSON.stringify(book2Res.data)}`);

    const m3Reg = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username: 'member3', email: 'm3@test.com', password: 'password123', durationMonths: 1 })
    });
    const book3Res = await request(`/api/classes/${classId}/book`, { method: 'POST' }, m3Reg.cookie);

    assert.strictEqual(book3Res.status, 400, `Expected 400 Bad Request for 3rd booking, got ${book3Res.status}`);
    assert(
      book3Res.data.message.toLowerCase().includes('capacity'),
      `Expected message to contain 'capacity', got: '${book3Res.data.message}'`
    );
    console.log('✅ Passed Test 4: 3rd booking correctly failed with 400 Bad Request: Class capacity reached.');

    // -------------------------------------------------------------
    // Test 5: Expired Member Booking Constraint
    // -------------------------------------------------------------
    console.log('\nTest 5: Expired Member Booking Attempt...');
    const User = require('../models/User');
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 10);

    const expiredUser = new User({
      username: 'expired_user',
      email: 'expired@fit.com',
      password: 'password123',
      membershipTier: 'Bronze',
      membershipStatus: 'expired',
      membershipExpiryDate: pastDate
    });
    await expiredUser.save();

    const expiredLogin = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'expired_user', password: 'password123' })
    });
    assert.strictEqual(expiredLogin.status, 200);

    const expiredBookRes = await request(`/api/classes/${classId}/book`, { method: 'POST' }, expiredLogin.cookie);
    assert.strictEqual(expiredBookRes.status, 400, `Expected 400 Bad Request for expired member, got ${expiredBookRes.status}`);
    assert(
      expiredBookRes.data.message.toLowerCase().includes('expired'),
      `Expected message to mention 'expired', got: '${expiredBookRes.data.message}'`
    );
    console.log('✅ Passed Test 5: Expired member booking attempt failed with 400 Bad Request.');

    // -------------------------------------------------------------
    // Test 6: Query Expired Members (/api/members/expired)
    // -------------------------------------------------------------
    console.log('\nTest 6: Query Expired Members (/api/members/expired)...');
    const expiredListRes = await request('/api/members/expired', { method: 'GET' });
    assert.strictEqual(expiredListRes.status, 200);
    assert(Array.isArray(expiredListRes.data), 'Expected array response');
    const hasExpiredUser = expiredListRes.data.some(u => u.username === 'expired_user');
    assert(hasExpiredUser, 'Expected expired_user to be in expired members list');
    console.log('✅ Passed Test 6: Expired members list retrieved successfully.');

    // -------------------------------------------------------------
    // Test 7: Renew Membership (/api/members/:id/renew)
    // -------------------------------------------------------------
    console.log('\nTest 7: Renew Expired Membership...');
    const renewRes = await request(`/api/members/${expiredUser._id}/renew`, {
      method: 'PATCH',
      body: JSON.stringify({ additionalMonths: 6, tier: 'Platinum' })
    });

    assert.strictEqual(renewRes.status, 200, `Expected 200 OK, got ${renewRes.status}`);
    assert.strictEqual(renewRes.data.user.membershipStatus, 'active');
    assert.strictEqual(renewRes.data.user.membershipTier, 'Platinum');
    const newExpiry = new Date(renewRes.data.user.membershipExpiryDate).getTime();
    assert(newExpiry > Date.now(), 'New expiry date should be in the future');
    console.log('✅ Passed Test 7: Membership renewed to Platinum with extended expiry date.');

    // -------------------------------------------------------------
    // Test 8: Filter Classes by Trainer & Cancel Booking
    // -------------------------------------------------------------
    console.log('\nTest 8: Filter Classes by Trainer & Cancel Booking...');
    const filterRes = await request('/api/classes?trainer=Maria', { method: 'GET' });
    assert.strictEqual(filterRes.status, 200);
    assert(filterRes.data.length > 0, 'Should return at least 1 class for Maria');

    const cancelRes = await request(`/api/classes/${classId}/cancel`, { method: 'DELETE' }, m1Reg.cookie);
    assert.strictEqual(cancelRes.status, 200, `Expected 200 OK for cancel booking, got ${cancelRes.status}`);

    const classDetailsRes = await request(`/api/classes/${classId}`, { method: 'GET' });
    assert.strictEqual(classDetailsRes.data.enrolledMembers.length, 1, 'Enrolled count should drop to 1');
    console.log('✅ Passed Test 8: Class filtered by trainer and booking cancelled successfully.');

    console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! (100% Verified)\n');
  } catch (err) {
    console.error('\n❌ TEST FAILED:', err);
    process.exitCode = 1;
  } finally {
    if (serverInstance) serverInstance.close();
    if (mongoose.connection.readyState !== 0) await mongoose.connection.close();
    if (mongoServer) await mongoServer.stop();
  }
}

runTests();
