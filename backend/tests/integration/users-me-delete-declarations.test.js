import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { EVENTS } from '../../src/constants/events.js';
import { Declaration } from '../../src/models/declaration.model.js';
import { RefreshToken } from '../../src/models/refresh-token.model.js';
import { User } from '../../src/models/user.model.js';
import { VerificationCode } from '../../src/models/verification-code.model.js';
import { buildTestApp } from '../helpers/build-test-app.js';
import { clearTestDb, connectTestDb, disconnectTestDb } from '../helpers/test-db.js';

const URL = '/api/v1/users/me';
const PASSWORD = 'Secret123';

// The whole chain: HTTP request, account deletion, user.deleted event,
// declaration cleanup, declaration.statusChanged events.
describe('DELETE /api/v1/users/me, effect on declarations', () => {
  let ctx;
  let sara;
  let omar;
  let token;
  let onStatusChanged;
  let off;

  const declare = (owner, overrides = {}) =>
    ctx.declarationRepository.create({
      title: 'Black backpack',
      type: 'lost',
      description: 'Black Nike backpack with a red keychain.',
      date: new Date('2026-10-12T00:00:00Z'),
      location: 'Main library, 2nd floor',
      owner: owner._id,
      category: 'wallet_bag',
      privateInfo: 'name on page 1',
      ...overrides,
    });

  const remove = () =>
    request(ctx.app)
      .delete(URL)
      .set('Authorization', `Bearer ${token}`)
      .send({ password: PASSWORD });

  const stored = (declaration) => Declaration.findById(declaration._id).select('+privateInfo');

  beforeAll(async () => {
    await connectTestDb();
    await User.init();
    await RefreshToken.init();
    await VerificationCode.init();
    await Declaration.init();
    ctx = buildTestApp();
  });

  afterAll(disconnectTestDb);
  afterEach(() => off());

  beforeEach(async () => {
    await clearTestDb();
    onStatusChanged = vi.fn();
    off = ctx.eventBus.on(EVENTS.DECLARATION_STATUS_CHANGED, onStatusChanged);
    const password = await ctx.passwordHasher.hash(PASSWORD);
    sara = await User.create({
      username: 'sara.k',
      email: 'sara@isamm.uma.tn',
      password,
      isEmailVerified: true,
    });
    omar = await User.create({
      username: 'omar.b',
      email: 'omar@isamm.uma.tn',
      password,
      isEmailVerified: true,
    });
    token = ctx.tokenService.signAccessToken(sara);
  });

  it('deletes the pending and expired declarations of the deleted user', async () => {
    const pending = await declare(sara);
    const expired = await declare(sara, { status: 'expired' });

    expect((await remove()).status).toBe(204);

    for (const declaration of [pending, expired]) {
      const after = await stored(declaration);
      expect(after.status).toBe('deleted');
      expect(after.deletedAt).toBeInstanceOf(Date);
    }
  });

  it('keeps matched, resolved and hidden declarations with their status', async () => {
    const kept = await Promise.all(
      ['matched', 'resolved', 'hidden'].map((status) => declare(sara, { status })),
    );

    await remove();

    for (const declaration of kept) {
      expect((await stored(declaration)).status).toBe(declaration.status);
    }
  });

  it('erases the private info of every declaration of the deleted user', async () => {
    const declarations = await Promise.all(
      ['pending', 'matched', 'resolved'].map((status) => declare(sara, { status })),
    );

    await remove();

    for (const declaration of declarations) {
      expect((await stored(declaration)).privateInfo).toBeNull();
    }
  });

  it('leaves the declarations of other users untouched', async () => {
    const theirs = await declare(omar);

    await remove();

    const after = await stored(theirs);
    expect(after.status).toBe('pending');
    expect(after.privateInfo).toBe('name on page 1');
  });

  it('announces a statusChanged event for each declaration it deleted', async () => {
    const pending = await declare(sara);
    await declare(sara, { status: 'resolved' });

    await remove();

    expect(onStatusChanged).toHaveBeenCalledTimes(1);
    expect(onStatusChanged).toHaveBeenCalledWith({
      declarationId: String(pending._id),
      ownerId: String(sara._id),
      from: 'pending',
      to: 'deleted',
      actor: 'system',
      reason: 'owner_deleted',
    });
  });

  it('still answers 204 for a user with no declaration', async () => {
    const res = await remove();

    expect(res.status).toBe(204);
    expect(onStatusChanged).not.toHaveBeenCalled();
  });
});
