import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import { Declaration } from '../../src/models/declaration.model.js';
import { toOwnerDeclarationResponse } from '../../src/presenters/declaration.presenter.js';

// A real model instance, built without a database.
function build(overrides = {}) {
  return new Declaration({
    title: 'Black backpack',
    type: 'lost',
    description: 'Black Nike backpack with a red keychain.',
    date: new Date('2026-10-12T00:00:00Z'),
    location: 'Main library, 2nd floor',
    owner: new mongoose.Types.ObjectId(),
    category: 'wallet_bag',
    attributes: { brand: 'Nike', color: 'black' },
    privateInfo: 'Name on page 1',
    ...overrides,
  });
}

describe('owner declaration presenter', () => {
  it('returns exactly the owner view, and nothing else', () => {
    const response = toOwnerDeclarationResponse(build());

    expect(Object.keys(response).sort()).toEqual([
      'attributes',
      'category',
      'createdAt',
      'date',
      'description',
      'id',
      'location',
      'picture',
      'privateInfo',
      'status',
      'title',
      'type',
      'updatedAt',
    ]);
  });

  it('never exposes the owner id, the internal fields or Mongoose internals', () => {
    const response = toOwnerDeclarationResponse(
      build({ status: 'hidden', statusBeforeHidden: 'pending', deletedAt: new Date() }),
    );
    const text = JSON.stringify(response);

    expect(response).not.toHaveProperty('owner');
    expect(response).not.toHaveProperty('statusBeforeHidden');
    expect(response).not.toHaveProperty('deletedAt');
    expect(response).not.toHaveProperty('_id');
    expect(response).not.toHaveProperty('__v');
    expect(text).not.toContain('pending');
  });

  it('uses the string id', () => {
    const doc = build();

    expect(toOwnerDeclarationResponse(doc).id).toBe(String(doc._id));
  });

  it('turns the attributes Map into a plain object that serializes', () => {
    const response = toOwnerDeclarationResponse(build());

    expect(response.attributes).toEqual({ brand: 'Nike', color: 'black' });
    expect(JSON.parse(JSON.stringify(response)).attributes).toEqual({
      brand: 'Nike',
      color: 'black',
    });
  });

  it('answers an empty object when there are no attributes', () => {
    expect(toOwnerDeclarationResponse(build({ attributes: undefined })).attributes).toEqual({});
  });

  it('answers null, not undefined, for the optional fields that are empty', () => {
    const response = toOwnerDeclarationResponse(build({ privateInfo: undefined }));

    expect(response.privateInfo).toBeNull();
    expect(response.picture).toBeNull();
  });

  it('also works on a plain object, such as a lean query result', () => {
    const id = new mongoose.Types.ObjectId();

    const response = toOwnerDeclarationResponse({
      _id: id,
      title: 'Black backpack',
      type: 'lost',
      description: 'Black Nike backpack with a red keychain.',
      category: 'wallet_bag',
      attributes: { brand: 'Nike' },
      status: 'pending',
      date: new Date('2026-10-12T00:00:00Z'),
      location: 'Main library',
      owner: new mongoose.Types.ObjectId(),
    });

    expect(response.id).toBe(String(id));
    expect(response.attributes).toEqual({ brand: 'Nike' });
    expect(response.privateInfo).toBeNull();
    expect(response).not.toHaveProperty('owner');
  });
});
