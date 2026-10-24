// Shared by every paginated list, so two endpoints never disagree on what a
// page is. The cap protects the server: nobody can ask for the whole
// collection in one request.
export const PAGINATION = Object.freeze({
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 50,
});
