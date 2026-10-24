import { describe, expect, it, vi } from 'vitest';
import { createDeclarationService } from '../../src/services/declaration.service.js';

const USER = { _id: '507f1f77bcf86cd799439011', role: 'user' };
const SAVED_ID = '507f1f77bcf86cd799439099';

const INPUT = {
  title: 'Black backpack',
  type: 'lost',
  description: 'Black Nike backpack with a red keychain.',
  date: new Date('2026-10-12T00:00:00Z'),
  location: 'Main library, 2nd floor',
  category: 'wallet_bag',
  attributes: { brand: 'Nike' },
  privateInfo: 'Name on page 1',
};

function setup({ create } = {}) {
  const declarationRepository = {
    create: create ?? vi.fn(async (data) => ({ _id: SAVED_ID, ...data })),
  };
  const eventBus = { emit: vi.fn().mockResolvedValue(undefined) };
  const service = createDeclarationService({ declarationRepository, eventBus });

  return { service, declarationRepository, eventBus };
}

describe('declaration service, create', () => {
  it('requires its dependencies', () => {
    expect(() => createDeclarationService({})).toThrow(/required/);
  });

  it('saves the user data with the owner from the user and the status pending', async () => {
    const { service, declarationRepository } = setup();

    await service.create(USER, INPUT);

    expect(declarationRepository.create).toHaveBeenCalledWith({
      ...INPUT,
      owner: USER._id,
      status: 'pending',
    });
  });

  it('returns what the repository saved', async () => {
    const { service } = setup();

    const declaration = await service.create(USER, INPUT);

    expect(declaration._id).toBe(SAVED_ID);
    expect(declaration.title).toBe('Black backpack');
  });

  it('does not send optional fields the user left out', async () => {
    const { service, declarationRepository } = setup();
    const { attributes, privateInfo, ...required } = INPUT;

    await service.create(USER, required);

    const saved = declarationRepository.create.mock.calls[0][0];
    expect(saved).not.toHaveProperty('attributes');
    expect(saved).not.toHaveProperty('privateInfo');
    expect(attributes).toBeDefined();
    expect(privateInfo).toBeDefined();
  });

  it('ignores owner, status and every other field that is not creatable, even if validation missed it', async () => {
    const { service, declarationRepository } = setup();

    await service.create(USER, {
      ...INPUT,
      owner: 'someone-else',
      status: 'resolved',
      deletedAt: new Date(),
      statusBeforeHidden: 'matched',
      picture: 'uploads/evil.png',
    });

    expect(declarationRepository.create).toHaveBeenCalledWith({
      ...INPUT,
      owner: USER._id,
      status: 'pending',
    });
  });

  it('announces declaration.created with string ids, after the save', async () => {
    const { service, declarationRepository, eventBus } = setup();

    await service.create(USER, INPUT);

    expect(eventBus.emit).toHaveBeenCalledTimes(1);
    expect(eventBus.emit).toHaveBeenCalledWith('declaration.created', {
      declarationId: SAVED_ID,
      ownerId: USER._id,
      type: 'lost',
      category: 'wallet_bag',
    });
    expect(declarationRepository.create.mock.invocationCallOrder[0]).toBeLessThan(
      eventBus.emit.mock.invocationCallOrder[0],
    );
  });

  it('announces nothing and rethrows when the save fails', async () => {
    const failure = new Error('database down');
    const { service, eventBus } = setup({ create: vi.fn().mockRejectedValue(failure) });

    await expect(service.create(USER, INPUT)).rejects.toBe(failure);
    expect(eventBus.emit).not.toHaveBeenCalled();
  });
});

describe('declaration service, listMine', () => {
  function setupList(result = { items: [], total: 0 }) {
    const declarationRepository = { findPageByOwner: vi.fn().mockResolvedValue(result) };
    const eventBus = { emit: vi.fn() };
    const service = createDeclarationService({ declarationRepository, eventBus });
    return { service, declarationRepository, eventBus };
  }

  it('asks for the page of the connected user, never of someone else', async () => {
    const { service, declarationRepository } = setupList();

    await service.listMine(USER, { page: 1, limit: 20 });

    expect(declarationRepository.findPageByOwner).toHaveBeenCalledWith(USER._id, {
      type: undefined,
      status: undefined,
      skip: 0,
      limit: 20,
    });
  });

  it('turns the page number into a skip', async () => {
    const { service, declarationRepository } = setupList();

    await service.listMine(USER, { page: 3, limit: 10 });

    expect(declarationRepository.findPageByOwner.mock.calls[0][1]).toMatchObject({
      skip: 20,
      limit: 10,
    });
  });

  it('passes the filters on', async () => {
    const { service, declarationRepository } = setupList();

    await service.listMine(USER, { page: 1, limit: 20, type: 'found', status: 'hidden' });

    expect(declarationRepository.findPageByOwner.mock.calls[0][1]).toMatchObject({
      type: 'found',
      status: 'hidden',
    });
  });

  it('returns the rows with the page, the limit, the total and the page count', async () => {
    const items = [{ _id: 'a' }, { _id: 'b' }];
    const { service } = setupList({ items, total: 41 });

    const result = await service.listMine(USER, { page: 2, limit: 20 });

    expect(result).toEqual({ items, page: 2, limit: 20, total: 41, totalPages: 3 });
  });

  it('counts zero pages when nothing matches', async () => {
    const { service } = setupList({ items: [], total: 0 });

    const result = await service.listMine(USER, { page: 1, limit: 20 });

    expect(result.totalPages).toBe(0);
  });

  it('announces nothing, a read changes nothing', async () => {
    const { service, eventBus } = setupList();

    await service.listMine(USER, { page: 1, limit: 20 });

    expect(eventBus.emit).not.toHaveBeenCalled();
  });
});
