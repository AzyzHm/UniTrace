// Shared by the Declaration model and the Joi schemas, so the two can never
// disagree on what a valid declaration looks like.
export const DECLARATION_LIMITS = Object.freeze({
  TITLE_MIN: 3,
  TITLE_MAX: 100,
  DESCRIPTION_MIN: 10,
  DESCRIPTION_MAX: 1000,
  LOCATION_MIN: 2,
  LOCATION_MAX: 150,
  PRIVATE_INFO_MAX: 500,
  ATTRIBUTE_VALUE_MAX: 100,
});
