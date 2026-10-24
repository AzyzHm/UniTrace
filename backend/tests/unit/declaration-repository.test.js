import { describe, expect, it, vi } from 'vitest';
import { createDeclarationRepository } from '../../src/repositories/declaration.repository.js';

// A fake model that records the queries, so the shape of each query is checked
// without a database. The integration test checks what MongoDB does with them.
function setup({ found = [] } = {}) {
  const lean = vi.fn().mockResolvedValue(found);
  const select = vi.fn(() => ({ lean }));
  const model = {
    find: vi.fn(() => ({ select })),
    updateMany: vi.fn().mockResolvedValue({ modifiedCount: 2 }),
  };
  return { repository: createDeclarationRepository({ model }), model, select };
}

const OWNER = '507f1f77bcf86cd799439011';
const DELETED_AT = new Date('2026-10-20T10:00:00Z');

describe('declaration repository, softDeleteByOwner', () => {
  it('finds the owner declarations in the given statuses, loading only the status', async () => {
    const { repository, model, select } = setup();

    await repository.softDeleteByOwner(OWNER, ['pending', 'expired'], DELETED_AT);

    expect(model.find).toHaveBeenCalledWith({
      owner: OWNER,
      status: { $in: ['pending', 'expired'] },
    });
    expect(select).toHaveBeenCalledWith('status');
  });

  it('does not update anything when there is nothing to delete', async () => {
    const { repository, model } = setup({ found: [] });

    const result = await repository.softDeleteByOwner(OWNER, ['pending'], DELETED_AT);

    expect(result).toEqual([]);
    expect(model.updateMany).not.toHaveBeenCalled();
  });

  it('updates by id, repeats the status filter, and sets status and date', async () => {
    const { repository, model } = setup({
      found: [
        { _id: 'a', status: 'pending' },
        { _id: 'b', status: 'expired' },
      ],
    });

    await repository.softDeleteByOwner(OWNER, ['pending', 'expired'], DELETED_AT);

    expect(model.updateMany).toHaveBeenCalledWith(
      { _id: { $in: ['a', 'b'] }, status: { $in: ['pending', 'expired'] } },
      { $set: { status: 'deleted', deletedAt: DELETED_AT } },
    );
  });

  it('returns the id as a string and the status it came from', async () => {
    const { repository } = setup({
      found: [
        { _id: { toString: () => 'a' }, status: 'pending' },
        { _id: { toString: () => 'b' }, status: 'expired' },
      ],
    });

    const result = await repository.softDeleteByOwner(OWNER, ['pending', 'expired'], DELETED_AT);

    expect(result).toEqual([
      { id: 'a', from: 'pending' },
      { id: 'b', from: 'expired' },
    ]);
  });
});

describe('declaration repository, clearPrivateInfoByOwner', () => {
  it('targets only the owner documents that still hold a private info', async () => {
    const { repository, model } = setup();

    const count = await repository.clearPrivateInfoByOwner(OWNER);

    expect(model.updateMany).toHaveBeenCalledWith(
      { owner: OWNER, privateInfo: { $ne: null } },
      { $set: { privateInfo: null } },
    );
    expect(count).toBe(2);
  });
});

// A fake model for the chained read: find().sort().skip().limit().lean().
function setupPage({ items = [], total = 0 } = {}) {
  const chain = {
    sort: vi.fn(() => chain),
    skip: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    lean: vi.fn().mockResolvedValue(items),
  };
  const model = {
    find: vi.fn(() => chain),
    countDocuments: vi.fn().mockResolvedValue(total),
  };
  return { repository: createDeclarationRepository({ model }), model, chain };
}

describe('declaration repository, findPageByOwner', () => {
  it('lists everything of the owner except deleted ones when no status is asked', async () => {
    const { repository, model } = setupPage();

    await repository.findPageByOwner(OWNER, { skip: 0, limit: 20 });

    expect(model.find).toHaveBeenCalledWith({ owner: OWNER, status: { $ne: 'deleted' } });
  });

  it('filters on the status and the type when they are given', async () => {
    const { repository, model } = setupPage();

    await repository.findPageByOwner(OWNER, {
      type: 'lost',
      status: 'matched',
      skip: 0,
      limit: 20,
    });

    expect(model.find).toHaveBeenCalledWith({ owner: OWNER, status: 'matched', type: 'lost' });
  });

  it('sorts newest first with the id as tie-breaker, then skips and limits', async () => {
    const { repository, chain } = setupPage();

    await repository.findPageByOwner(OWNER, { skip: 40, limit: 20 });

    expect(chain.sort).toHaveBeenCalledWith({ createdAt: -1, _id: -1 });
    expect(chain.skip).toHaveBeenCalledWith(40);
    expect(chain.limit).toHaveBeenCalledWith(20);
    expect(chain.lean).toHaveBeenCalled();
  });

  it('counts with the same filter, without skip and limit', async () => {
    const { repository, model } = setupPage();

    await repository.findPageByOwner(OWNER, { type: 'found', skip: 20, limit: 10 });

    expect(model.countDocuments).toHaveBeenCalledWith({
      owner: OWNER,
      status: { $ne: 'deleted' },
      type: 'found',
    });
  });

  it('returns the rows and the total', async () => {
    const { repository } = setupPage({ items: [{ _id: 'a' }], total: 7 });

    const result = await repository.findPageByOwner(OWNER, { skip: 0, limit: 1 });

    expect(result).toEqual({ items: [{ _id: 'a' }], total: 7 });
  });
});
