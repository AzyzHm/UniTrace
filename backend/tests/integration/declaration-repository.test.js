import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Declaration } from '../../src/models/declaration.model.js';
import { createDeclarationRepository } from '../../src/repositories/declaration.repository.js';
import { clearTestDb, connectTestDb, disconnectTestDb } from '../helpers/test-db.js';

const DELETED_AT = new Date('2026-10-20T10:00:00Z');
const OPEN = ['pending', 'expired'];

describe('declaration repository', () => {
  const repository = createDeclarationRepository();
  const sara = new mongoose.Types.ObjectId();
  const omar = new mongoose.Types.ObjectId();

  const create = (overrides = {}) =>
    repository.create({
      title: 'Black backpack',
      type: 'lost',
      description: 'Black Nike backpack with a red keychain.',
      date: new Date('2026-10-12T00:00:00Z'),
      location: 'Main library, 2nd floor',
      owner: sara,
      category: 'wallet_bag',
      ...overrides,
    });

  beforeAll(async () => {
    await connectTestDb();
    await Declaration.init();
  });

  afterAll(disconnectTestDb);
  beforeEach(clearTestDb);

  describe('create and read', () => {
    it('stores the defaults', async () => {
      const declaration = await create();

      expect(declaration.status).toBe('pending');
      expect(declaration.statusBeforeHidden).toBeNull();
      expect(declaration.deletedAt).toBeNull();
      expect(declaration.createdAt).toBeInstanceOf(Date);
    });

    it('stores and returns the attributes as a plain object', async () => {
      const declaration = await create({ attributes: { brand: 'Nike', color: 'black' } });

      const found = await repository.findById(declaration._id);

      expect(JSON.parse(JSON.stringify(found)).attributes).toEqual({
        brand: 'Nike',
        color: 'black',
      });
    });

    it('stores statusBeforeHidden next to a hidden status', async () => {
      const declaration = await create({ status: 'hidden', statusBeforeHidden: 'matched' });

      expect((await repository.findById(declaration._id)).statusBeforeHidden).toBe('matched');
    });

    it('keeps the private info out of a normal read', async () => {
      const declaration = await create({ privateInfo: 'name on page 1' });

      const found = await repository.findById(declaration._id);

      expect(found.privateInfo).toBeUndefined();
      expect(JSON.stringify(found)).not.toContain('name on page 1');
    });

    it('returns the private info only through the explicit read', async () => {
      const declaration = await create({ privateInfo: 'name on page 1' });

      const found = await repository.findByIdWithPrivateInfo(declaration._id);

      expect(found.privateInfo).toBe('name on page 1');
    });

    it('returns null for an unknown id', async () => {
      expect(await repository.findById(new mongoose.Types.ObjectId())).toBeNull();
    });

    it('rejects a document that breaks the schema, before touching the database', async () => {
      await expect(create({ type: 'stolen' })).rejects.toMatchObject({ name: 'ValidationError' });
      expect(await Declaration.countDocuments()).toBe(0);
    });

    it('builds the declared indexes', async () => {
      const indexes = await Declaration.collection.indexes();
      const keys = indexes.map((index) => index.key);

      expect(keys).toContainEqual({ type: 1, category: 1, status: 1, date: -1 });
      expect(keys).toContainEqual({ owner: 1, createdAt: -1 });
    });
  });

  describe('softDeleteByOwner', () => {
    it('deletes the owner declarations in the given statuses and reports each one', async () => {
      const pending = await create();
      const expired = await create({ status: 'expired' });

      const result = await repository.softDeleteByOwner(sara, OPEN, DELETED_AT);

      expect(result).toHaveLength(2);
      expect(result).toContainEqual({ id: String(pending._id), from: 'pending' });
      expect(result).toContainEqual({ id: String(expired._id), from: 'expired' });
      for (const id of [pending._id, expired._id]) {
        const stored = await Declaration.findById(id);
        expect(stored.status).toBe('deleted');
        expect(stored.deletedAt).toEqual(DELETED_AT);
      }
    });

    it('leaves matched, resolved and hidden declarations as they are', async () => {
      const kept = await Promise.all(
        ['matched', 'resolved', 'hidden'].map((status) => create({ status })),
      );

      const result = await repository.softDeleteByOwner(sara, OPEN, DELETED_AT);

      expect(result).toEqual([]);
      for (const declaration of kept) {
        const stored = await Declaration.findById(declaration._id);
        expect(stored.status).toBe(declaration.status);
        expect(stored.deletedAt).toBeNull();
      }
    });

    it('leaves the declarations of other owners alone', async () => {
      const others = await create({ owner: omar });

      await repository.softDeleteByOwner(sara, OPEN, DELETED_AT);

      expect((await Declaration.findById(others._id)).status).toBe('pending');
    });

    it('returns an empty list for an owner with nothing to delete', async () => {
      expect(await repository.softDeleteByOwner(sara, OPEN, DELETED_AT)).toEqual([]);
    });

    it('does not report a declaration that is already deleted', async () => {
      await create({ status: 'deleted' });

      expect(await repository.softDeleteByOwner(sara, OPEN, DELETED_AT)).toEqual([]);
    });
  });

  describe('clearPrivateInfoByOwner', () => {
    it('erases the private info of every status of the owner and counts them', async () => {
      const a = await create({ privateInfo: 'one' });
      const b = await create({ status: 'resolved', privateInfo: 'two' });
      await create();

      const count = await repository.clearPrivateInfoByOwner(sara);

      expect(count).toBe(2);
      for (const id of [a._id, b._id]) {
        expect((await repository.findByIdWithPrivateInfo(id)).privateInfo).toBeNull();
      }
    });

    it('leaves the other fields and the other owners alone', async () => {
      const mine = await create({ privateInfo: 'one' });
      const theirs = await create({ owner: omar, privateInfo: 'secret' });

      await repository.clearPrivateInfoByOwner(sara);

      expect((await repository.findById(mine._id)).title).toBe('Black backpack');
      expect((await repository.findByIdWithPrivateInfo(theirs._id)).privateInfo).toBe('secret');
    });

    it('counts nothing when no declaration holds a private info', async () => {
      await create();

      expect(await repository.clearPrivateInfoByOwner(sara)).toBe(0);
    });
  });
});
