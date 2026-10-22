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
