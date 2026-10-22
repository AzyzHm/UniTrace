import mongoose from 'mongoose';
import { CATEGORY_KEYS } from '../constants/categories.js';
import { DECLARATION_LIMITS as LIMITS } from '../constants/declaration-limits.js';
import {
  DECLARATION_STATUS_VALUES,
  DEFAULT_DECLARATION_STATUS,
} from '../constants/declaration-status.js';
import { DECLARATION_TYPE_VALUES } from '../constants/declaration-types.js';

const declarationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: LIMITS.TITLE_MIN,
      maxlength: LIMITS.TITLE_MAX,
    },
    type: {
      type: String,
      required: true,
      enum: DECLARATION_TYPE_VALUES,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: LIMITS.DESCRIPTION_MIN,
      maxlength: LIMITS.DESCRIPTION_MAX,
    },
    // Path of the stored image. The upload step fills it in.
    picture: {
      type: String,
      trim: true,
      default: null,
    },
    // The user never picks it: the service forces "pending" on creation.
    status: {
      type: String,
      enum: DECLARATION_STATUS_VALUES,
      default: DEFAULT_DECLARATION_STATUS,
    },
    // Set when an admin hides the declaration, so "restore" knows where to go
    // back to. Null the rest of the time. null is in the enum on purpose.
    statusBeforeHidden: {
      type: String,
      enum: [...DECLARATION_STATUS_VALUES, null],
      default: null,
    },
    // The day the item was lost or found. "Not in the future" is checked by
    // the Joi schema, because it depends on the clock of each request.
    date: {
      type: Date,
      required: true,
    },
    // A plain string on purpose (team decision). The frontend suggests common
    // campus places, the database stores what was typed.
    location: {
      type: String,
      required: true,
      trim: true,
      minlength: LIMITS.LOCATION_MIN,
      maxlength: LIMITS.LOCATION_MAX,
    },
    // Set from the token by the server, never from the request body.
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    category: {
      type: String,
      required: true,
      enum: CATEGORY_KEYS,
    },
    // Category-specific details such as brand or color. Short strings only,
    // the Joi schema restricts the keys.
    attributes: {
      type: Map,
      of: { type: String, trim: true, maxlength: LIMITS.ATTRIBUTE_VALUE_MAX },
      default: () => ({}),
    },
    // A detail only the real owner knows (a name on page 1, a scratch). Hidden
    // from every query unless the repository asks for it with
    // "+privateInfo", like the password hash of a user.
    privateInfo: {
      type: String,
      trim: true,
      maxlength: LIMITS.PRIVATE_INFO_MAX,
      default: null,
      select: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      // A Map would otherwise be serialized as an empty object by JSON.stringify.
      flattenMaps: true,
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  },
);

// Binome 2 search: filter by type, category and status, newest date first.
// The text index on title and description is theirs to add, with their
// language choice.
declarationSchema.index({ type: 1, category: 1, status: 1, date: -1 });

// "My declarations", newest first. Its owner prefix also serves every
// per-owner bulk update (account deletion).
declarationSchema.index({ owner: 1, createdAt: -1 });

export const Declaration = mongoose.model('Declaration', declarationSchema);
