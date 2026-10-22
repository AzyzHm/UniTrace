import { describe, expect, it, vi } from 'vitest';
import { EVENTS } from '../../src/constants/events.js';
import { createDeclarationCleanupService } from '../../src/services/declaration-cleanup.service.js';

const OWNER = '507f1f77bcf86cd799439011';
const DELETED_AT = new Date('2026-10-20T10:00:00Z');

function setup({ removed = [], clear, remove } = {}) {
  const declarationRepository = {
    clearPrivateInfoByOwner: clear ?? vi.fn().mockResolvedValue(0),
    softDeleteByOwner: remove ?? vi.fn().mockResolvedValue(removed),
  };
  const eventBus = { emit: vi.fn().mockResolvedValue(undefined) };
  const service = createDeclarationCleanupService({ declarationRepository, eventBus });
  return { service, declarationRepository, eventBus };
}

describe('declaration cleanup service', () => {
  it('requires its dependencies', () => {
    expect(() => createDeclarationCleanupService({ eventBus: {} })).toThrow(
      /declarationRepository is required/,
    );
    expect(() => createDeclarationCleanupService({ declarationRepository: {} })).toThrow(
      /eventBus is required/,
    );
  });

  it('deletes only pending and expired declarations, with the deletion date', async () => {
    const { service, declarationRepository } = setup();

    await service.handleOwnerDeleted({ userId: OWNER, deletedAt: DELETED_AT });

    expect(declarationRepository.softDeleteByOwner).toHaveBeenCalledWith(
      OWNER,
      ['pending', 'expired'],
      DELETED_AT,
    );
  });

  it('wipes the private info of every declaration of the owner', async () => {
    const { service, declarationRepository } = setup();

    await service.handleOwnerDeleted({ userId: OWNER, deletedAt: DELETED_AT });

    expect(declarationRepository.clearPrivateInfoByOwner).toHaveBeenCalledWith(OWNER);
  });

  it('announces one statusChanged event per declaration it deleted', async () => {
    const { service, eventBus } = setup({
      removed: [
        { id: 'd1', from: 'pending' },
        { id: 'd2', from: 'expired' },
      ],
    });

    await service.handleOwnerDeleted({ userId: OWNER, deletedAt: DELETED_AT });

    expect(eventBus.emit).toHaveBeenCalledTimes(2);
    expect(eventBus.emit).toHaveBeenCalledWith(EVENTS.DECLARATION_STATUS_CHANGED, {
      declarationId: 'd1',
      ownerId: OWNER,
      from: 'pending',
      to: 'deleted',
      actor: 'system',
      reason: 'owner_deleted',
    });
    expect(eventBus.emit.mock.calls[1][1]).toMatchObject({ declarationId: 'd2', from: 'expired' });
  });

  it('emits nothing when there was nothing to delete', async () => {
    const { service, eventBus } = setup({ removed: [] });

    await service.handleOwnerDeleted({ userId: OWNER, deletedAt: DELETED_AT });

    expect(eventBus.emit).not.toHaveBeenCalled();
  });

  it('still deletes when wiping fails, announces it, then rethrows the failure', async () => {
    const boom = new Error('wipe failed');
    const { service, eventBus, declarationRepository } = setup({
      clear: vi.fn().mockRejectedValue(boom),
      removed: [{ id: 'd1', from: 'pending' }],
    });

    await expect(service.handleOwnerDeleted({ userId: OWNER, deletedAt: DELETED_AT })).rejects.toBe(
      boom,
    );

    expect(declarationRepository.softDeleteByOwner).toHaveBeenCalled();
    expect(eventBus.emit).toHaveBeenCalledTimes(1);
  });

  it('still wipes when deleting fails, and rethrows the failure', async () => {
    const boom = new Error('delete failed');
    const { service, eventBus, declarationRepository } = setup({
      remove: vi.fn().mockRejectedValue(boom),
    });

    await expect(service.handleOwnerDeleted({ userId: OWNER, deletedAt: DELETED_AT })).rejects.toBe(
      boom,
    );

    expect(declarationRepository.clearPrivateInfoByOwner).toHaveBeenCalled();
    expect(eventBus.emit).not.toHaveBeenCalled();
  });

  it('turns an ObjectId owner into a string in the event', async () => {
    const { service, eventBus } = setup({ removed: [{ id: 'd1', from: 'pending' }] });

    await service.handleOwnerDeleted({
      userId: { toString: () => OWNER, valueOf: () => OWNER },
      deletedAt: DELETED_AT,
    });

    expect(typeof eventBus.emit.mock.calls[0][1].ownerId).toBe('string');
  });
});
