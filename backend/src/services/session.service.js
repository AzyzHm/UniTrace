import {
  EmailNotVerifiedError,
  ForbiddenError,
  UnauthenticatedError,
} from '../exceptions/app-error.js';

const INVALID_CREDENTIALS = 'Invalid email or password';
const DUMMY_PASSWORD = 'unitrace-dummy-password';

// Everything about a login session: today the login, in 3.5 refresh and logout.
// Account creation and email verification stay in the auth service.
export function createSessionService({ userRepository, passwordHasher, tokenService }) {
  // A real hash made by the same hasher, so it has the same cost as real ones.
  // Built once, on first use.
  let dummyHash;
  const getDummyHash = () => {
    dummyHash ??= passwordHasher.hash(DUMMY_PASSWORD);
    return dummyHash;
  };

  return {
    async login({ email, password }) {
      const user = await userRepository.findByEmailWithPassword(email);

      // One bcrypt comparison in every case, so an unknown email takes as long
      // as a wrong password and the response time reveals nothing.
      const hash = user ? user.password : await getDummyHash();
      const passwordMatches = await passwordHasher.compare(password, hash);
      if (!user || !passwordMatches) throw new UnauthenticatedError(INVALID_CREDENTIALS);

      // Only after the password is right, so these states are never shown to
      // someone who does not know it.
      if (!user.isEmailVerified) throw new EmailNotVerifiedError();
      if (!user.isActive) throw new ForbiddenError('Your account is suspended');

      return { user, accessToken: tokenService.signAccessToken(user) };
    },
  };
}
