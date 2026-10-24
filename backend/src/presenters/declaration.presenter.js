import { CATEGORIES } from '../constants/categories.js';

// A Mongoose document holds attributes as a Map, a lean object holds a plain
// object. Both come out as a plain object.
function toPlainAttributes(attributes) {
  if (!attributes) return {};
  return attributes instanceof Map ? Object.fromEntries(attributes) : { ...attributes };
}

// What the OWNER sees (and later an admin): everything the owner typed, plus
// the hidden detail. The owner's own id is left out, they know who they are.
// Never use it for another user: that one gets the public split instead.
//
// A whitelist on purpose, not a copy of the document: a field added to the
// model later (a flag, an internal note) stays private until someone adds it
// here deliberately. statusBeforeHidden and deletedAt are internal.
export function toOwnerDeclarationResponse(declaration) {
  return {
    id: declaration.id ?? String(declaration._id),
    title: declaration.title,
    type: declaration.type,
    description: declaration.description,
    category: declaration.category,
    attributes: toPlainAttributes(declaration.attributes),
    privateInfo: declaration.privateInfo ?? null,
    picture: declaration.picture ?? null,
    status: declaration.status,
    date: declaration.date,
    location: declaration.location,
    createdAt: declaration.createdAt,
    updatedAt: declaration.updatedAt,
  };
}

// What ANY OTHER user sees (spec 6.2 and 9.3). The strict public split:
// no privateInfo, no owner (not even an id: who owns an item is revealed only
// inside an accepted match), no internal field, no updatedAt. Same whitelist
// logic as above.
//
// The picture of a sensitive category (a student card) is never public, even
// when one was stored: a photo of an ID shows a name and a face (spec 6.3).
export function toPublicDeclarationResponse(declaration) {
  const isSensitive = CATEGORIES[declaration.category]?.sensitive === true;

  return {
    id: declaration.id ?? String(declaration._id),
    title: declaration.title,
    type: declaration.type,
    description: declaration.description,
    category: declaration.category,
    attributes: toPlainAttributes(declaration.attributes),
    picture: isSensitive ? null : (declaration.picture ?? null),
    status: declaration.status,
    date: declaration.date,
    location: declaration.location,
    createdAt: declaration.createdAt,
  };
}

// One row of a list. It is the owner view WITHOUT the long and private parts:
// no privateInfo (never in a list, spec 9.3), no description and no
// attributes (the detail route returns them). A whitelist again, so a field
// added to the model never reaches a list by accident.
export function toDeclarationSummary(declaration) {
  return {
    id: declaration.id ?? String(declaration._id),
    title: declaration.title,
    type: declaration.type,
    category: declaration.category,
    picture: declaration.picture ?? null,
    status: declaration.status,
    date: declaration.date,
    location: declaration.location,
    createdAt: declaration.createdAt,
    updatedAt: declaration.updatedAt,
  };
}
