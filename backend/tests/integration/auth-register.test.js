import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { User } from '../../src/models/user.model.js';
import { createUserRepository } from '../../src/repositories/user.repository.js';
import { createAuthService } from '../../src/services/auth.service.js';
import { createPasswordHasher } from '../../src/services/password-hasher.js';
import { clearTestDb, connectTestDb, disconnectTestDb } from '../helpers/test-db.js';

const URL = '/api/v1/auth/register';

function buildBody(overrides = {}) {
  return {
    username: 'sara.k',
    email: 'sara@isamm.uma.tn',
    phone: '+21612345678',
    password: 'Secret123',
    confirmPassword: 'Secret123',
    ...overrides,
  };
}

describe('POST /api/v1/auth/register', () => {
  let app;

  beforeAll(async () => {
    await connectTestDb();
    await User.init();

    app = createApp({
      authService: createAuthService({
        userRepository: createUserRepository(),
        passwordHasher: createPasswordHasher({ cost: 4 }),
      }),
      allowedEmailDomains: ['isamm.uma.tn'],
    });
  });

  afterAll(disconnectTestDb);
  beforeEach(clearTestDb);

  it('creates an unverified user and answers 201 with a safe shape', async () => {
    const res = await request(app).post(URL).send(buildBody());

    expect(res.status).toBe(201);
    expect(Object.keys(res.body.user).sort()).toEqual([
      'createdAt',
      'email',
      'id',
      'isEmailVerified',
      'phone',
      'role',
      'username',
    ]);
    expect(res.body.user.role).toBe('user');
    expect(res.body.user.isEmailVerified).toBe(false);
  });

  it('returns no token and sets no cookie', async () => {
    const res = await request(app).post(URL).send(buildBody());

    expect(res.body.accessToken).toBeUndefined();
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('never exposes the password, plain or hashed', async () => {
    const res = await request(app).post(URL).send(buildBody());

    expect(JSON.stringify(res.body)).not.toMatch(/password|Secret123|\$2[aby]\$/i);
  });

  it('stores a bcrypt hash and a lowercased email', async () => {
    await request(app)
      .post(URL)
      .send(buildBody({ email: 'Sara@ISAMM.uma.tn' }));

    const stored = await User.findOne().select('+password');
    expect(stored.password).toMatch(/^\$2[aby]\$/);
    expect(stored.email).toBe('sara@isamm.uma.tn');
  });

  it('rejects a role in the body and creates nothing', async () => {
    const res = await request(app)
      .post(URL)
      .send(buildBody({ role: 'admin' }));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual([{ field: 'role', message: 'role is not allowed' }]);
    expect(await User.countDocuments()).toBe(0);
  });

  it('rejects a mismatched confirmPassword', async () => {
    const res = await request(app)
      .post(URL)
      .send(buildBody({ confirmPassword: 'Other123' }));

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([
      { field: 'confirmPassword', message: 'Passwords do not match' },
    ]);
  });

  it('rejects a non university email', async () => {
    const res = await request(app)
      .post(URL)
      .send(buildBody({ email: 'sara@gmail.com' }));

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('email');
  });

  it('answers 409 for a duplicate email', async () => {
    await request(app).post(URL).send(buildBody());

    const res = await request(app)
      .post(URL)
      .send(buildBody({ username: 'other.user' }));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    expect(res.body.error.details).toEqual([{ field: 'email', message: 'Email is already used' }]);
  });

  it('answers 409 for a duplicate username, ignoring case', async () => {
    await request(app)
      .post(URL)
      .send(buildBody({ username: 'Sara.K' }));

    const res = await request(app)
      .post(URL)
      .send(buildBody({ username: 'sara.k', email: 'other@isamm.uma.tn' }));

    expect(res.status).toBe(409);
    expect(res.body.error.details[0].field).toBe('username');
  });

  it('lets exactly one of two simultaneous registrations win', async () => {
    const [first, second] = await Promise.all([
      request(app).post(URL).send(buildBody()),
      request(app).post(URL).send(buildBody()),
    ]);

    expect([first.status, second.status].sort()).toEqual([201, 409]);
    expect(await User.countDocuments()).toBe(1);
  });
});
