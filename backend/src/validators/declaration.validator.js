import Joi from 'joi';
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
