import { describe, expect, it, vi } from 'vitest';
import {
  EmailNotVerifiedError,
  ForbiddenError,
  UnauthenticatedError,
} from '../../src/exceptions/app-error.js';
import { createSessionService } from '../../src/services/session.service.js';

const USER = {
  _id: '507f1f77bcf86cd799439011',
  email: 'sara@isamm.uma.tn',
  password: 'stored-hash',
  isEmailVerified: true,
  isActive: true,
};
const INPUT = { email: USER.email, password: 'Secret123' };

function setup({ user = USER, passwordMatches = true } = {}) {
  const userRepository = { findByEmailWithPassword: vi.fn().mockResolvedValue(user) };
  const passwordHasher = {
    hash: vi.fn().mockResolvedValue('dummy-hash'),
    compare: vi.fn().mockResolvedValue(passwordMatches),
  };
  const tokenService = { signAccessToken: vi.fn().mockReturnValue('signed.jwt.token') };
  const service = createSessionService({ userRepository, passwordHasher, tokenService });

  return { service, userRepository, passwordHasher, tokenService };
}

describe('session service, login', () => {
  it('returns the user and a signed token for the right credentials', async () => {
    const { service, userRepository, passwordHasher, tokenService } = setup();

    const result = await service.login(INPUT);

    expect(userRepository.findByEmailWithPassword).toHaveBeenCalledWith(INPUT.email);
    expect(passwordHasher.compare).toHaveBeenCalledWith('Secret123', 'stored-hash');
    expect(tokenService.signAccessToken).toHaveBeenCalledWith(USER);
    expect(result).toEqual({ user: USER, accessToken: 'signed.jwt.token' });
  });

  it('refuses a wrong password with a generic message and signs nothing', async () => {
    const { service, tokenService } = setup({ passwordMatches: false });

    const error = await service.login(INPUT).catch((e) => e);

    expect(error).toBeInstanceOf(UnauthenticatedError);
    expect(error.message).toBe('Invalid email or password');
    expect(tokenService.signAccessToken).not.toHaveBeenCalled();
  });

  it('refuses an unknown email with the same error, even if the comparison says yes', async () => {
    const { service, tokenService } = setup({ user: null, passwordMatches: true });

    const error = await service.login(INPUT).catch((e) => e);

    expect(error).toBeInstanceOf(UnauthenticatedError);
    expect(error.message).toBe('Invalid email or password');
    expect(tokenService.signAccessToken).not.toHaveBeenCalled();
  });

  it('still runs one comparison for an unknown email, against a dummy hash', async () => {
    const { service, passwordHasher } = setup({ user: null });

    await service.login(INPUT).catch(() => {});

    expect(passwordHasher.compare).toHaveBeenCalledTimes(1);
    expect(passwordHasher.compare).toHaveBeenCalledWith('Secret123', 'dummy-hash');
  });

  it('builds the dummy hash only once', async () => {
    const { service, passwordHasher } = setup({ user: null });

    await service.login(INPUT).catch(() => {});
    await service.login(INPUT).catch(() => {});

    expect(passwordHasher.hash).toHaveBeenCalledTimes(1);
  });

  it('refuses an unverified account when the password is right', async () => {
    const { service, tokenService } = setup({ user: { ...USER, isEmailVerified: false } });

    await expect(service.login(INPUT)).rejects.toBeInstanceOf(EmailNotVerifiedError);
    expect(tokenService.signAccessToken).not.toHaveBeenCalled();
  });

  it('does not reveal an unverified account when the password is wrong', async () => {
    const { service } = setup({
      user: { ...USER, isEmailVerified: false },
      passwordMatches: false,
    });

    await expect(service.login(INPUT)).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it('refuses a suspended account when the password is right', async () => {
    const { service, tokenService } = setup({ user: { ...USER, isActive: false } });

    await expect(service.login(INPUT)).rejects.toBeInstanceOf(ForbiddenError);
    expect(tokenService.signAccessToken).not.toHaveBeenCalled();
  });

  it('does not reveal a suspended account when the password is wrong', async () => {
    const { service } = setup({ user: { ...USER, isActive: false }, passwordMatches: false });

    await expect(service.login(INPUT)).rejects.toBeInstanceOf(UnauthenticatedError);
  });
});
