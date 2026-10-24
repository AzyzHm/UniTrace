import Joi from 'joi';
import { PAGINATION } from '../constants/pagination.js';
import { DECLARATION_STATUS_VALUES } from '../constants/declaration-status.js';
import {
  attributesField,
  categoryField,
  dateField,
  descriptionField,
  locationField,
  privateInfoField,
  titleField,
  typeField,
} from './declaration-fields.js';

// Unknown fields are refused by the validate middleware, so "status", "owner",
// "deletedAt" or "statusBeforeHidden" in the body is a 400 and never reaches
// the service. "picture" is refused too: it will come from the upload step,
// never from a string typed by the client.
export const createDeclarationSchema = Joi.object({
  title: titleField().required(),
  type: typeField().required(),
  description: descriptionField().required(),
  date: dateField().required(),
  location: locationField().required(),
  category: categoryField().required(),
  attributes: attributesField(),
  privateInfo: privateInfoField(),
});

// Exactly the 24 hex characters of a MongoDB ObjectId, nothing around them.
// One pattern rather than hex() plus length(): a bad value then gives ONE
// error, not two identical messages.
const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

// The ":id" of every "/declarations/:id" route. Mongoose would also cast other
// shapes (a 12 character string, for instance), so the strict check is done
// here, before the database is asked anything: a malformed id is a 400, not a
// 500 from a CastError.
export const declarationIdParamsSchema = Joi.object({
  id: Joi.string().pattern(OBJECT_ID_PATTERN).required().messages({
    'string.base': 'id must be a valid declaration id',
    'string.empty': 'id must be a valid declaration id',
    'string.pattern.base': 'id must be a valid declaration id',
    'any.required': 'id is required',
  }),
});

// "deleted" is not a valid filter: a soft deleted declaration is gone for its
// owner too, so the list never shows it and asking for it is a mistake worth
// a 400 rather than a silent empty page.
const LISTABLE_STATUS_VALUES = DECLARATION_STATUS_VALUES.filter((status) => status !== 'deleted');

// Query strings always arrive as text. Joi converts "2" to 2 (the validate
// middleware keeps convert: true) and refuses "abc", "1.5" and "-1". A limit
// above the cap is refused instead of silently lowered, so the client learns
// the real maximum from the error.
export const listMyDeclarationsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(PAGINATION.DEFAULT_PAGE),
  limit: Joi.number().integer().min(1).max(PAGINATION.MAX_LIMIT).default(PAGINATION.DEFAULT_LIMIT),
  type: typeField(),
  status: Joi.string().valid(...LISTABLE_STATUS_VALUES),
});
