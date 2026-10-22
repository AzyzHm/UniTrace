import Joi from 'joi';
import { CATEGORY_KEYS } from '../constants/categories.js';
import { DECLARATION_LIMITS as LIMITS } from '../constants/declaration-limits.js';
import { DECLARATION_TYPE_VALUES } from '../constants/declaration-types.js';

// A letter first, then letters, digits and "_". It keeps "$" and "." out of
// the keys (MongoDB refuses them in a Map) and "__proto__" out of the object.
const ATTRIBUTE_KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{0,29}$/;
const MAX_ATTRIBUTES = 10;

// The rules for each declaration field, shared by the create schema and the
// future update schema, so the two can never drift apart. None of them says
// "required": that is the job of the schema that uses them. The numbers come
// from DECLARATION_LIMITS, the same constants the Mongoose model uses.

export const titleField = () => Joi.string().trim().min(LIMITS.TITLE_MIN).max(LIMITS.TITLE_MAX);

export const typeField = () => Joi.string().valid(...DECLARATION_TYPE_VALUES);

export const descriptionField = () =>
  Joi.string().trim().min(LIMITS.DESCRIPTION_MIN).max(LIMITS.DESCRIPTION_MAX);

export const locationField = () =>
  Joi.string().trim().min(LIMITS.LOCATION_MIN).max(LIMITS.LOCATION_MAX);

export const categoryField = () => Joi.string().valid(...CATEGORY_KEYS);

const DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/;

// Joi accepts "2026-02-31" and quietly turns it into 3 March, because the
// JavaScript Date rolls an impossible day over. The date written in the
// request must be the date that is stored, so the day is checked against the
// calendar. The compact form "20261012" is refused here for the same reason:
// one accepted format keeps this check simple.
function checkCalendarDay(value, helpers) {
  const match = DATE_PREFIX.exec(String(helpers.original));
  if (!match) return helpers.error('date.format');

  const [, year, month, day] = match.map(Number);
  const real = new Date(Date.UTC(year, month - 1, day));
  const isRealDay = real.getUTCMonth() === month - 1 && real.getUTCDate() === day;

  return isRealDay ? value : helpers.error('date.format');
}

// iso() refuses numbers and free text such as "yesterday". max('now') is read
// at each validation, which is why this rule lives here and not in the model.
export const dateField = () =>
  Joi.date().iso().custom(checkCalendarDay).max('now').messages({
    'date.format': 'Date must be a valid ISO date, for example 2026-10-12',
    'date.base': 'Date must be a valid ISO date, for example 2026-10-12',
    'date.max': 'Date cannot be in the future',
  });

// Short strings only, under keys of a safe shape. Which keys make sense for
// which category is left open on purpose (spec 6.3): it can be tightened later
// without changing the API.
export const attributesField = () =>
  Joi.object()
    .pattern(ATTRIBUTE_KEY_PATTERN, Joi.string().trim().max(LIMITS.ATTRIBUTE_VALUE_MAX))
    .max(MAX_ATTRIBUTES);

export const privateInfoField = () => Joi.string().trim().max(LIMITS.PRIVATE_INFO_MAX);
