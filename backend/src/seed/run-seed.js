import { ADMIN_USERNAME, SEED_DECLARATIONS, SEED_USERS } from './seed-data.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const silentLogger = { info() {} };

// Fills an empty database with one admin, a few verified users and a spread of
// declarations. It only uses repositories, like the rest of the app.
//
// Safe to run twice: if the admin already exists it stops and changes
// nothing, instead of guessing which half-seeded documents to repair.
export async function runSeed({
  userRepository,
  declarationRepository,
  passwordHasher,
  password,
  emailDomain,
  now = new Date(),
  logger = silentLogger,
}) {
  const adminEmail = `${ADMIN_USERNAME}@${emailDomain}`;
  if (await userRepository.findByEmail(adminEmail)) {
    logger.info('Seed skipped: the admin already exists');
    return { skipped: true, users: 0, declarations: 0 };
  }

  // One hash for everybody: they all share the seed password.
  const passwordHash = await passwordHasher.hash(password);

  const ownerIds = new Map();
  for (const { username, role, phone } of SEED_USERS) {
    const user = await userRepository.create({
      username,
      email: `${username}@${emailDomain}`,
      phone,
      password: passwordHash,
      role,
      isEmailVerified: true,
    });
    ownerIds.set(username, user._id);
  }

  for (const { owner, daysAgo, ...fields } of SEED_DECLARATIONS) {
    await declarationRepository.create({
      ...fields,
      owner: ownerIds.get(owner),
      date: new Date(now.getTime() - daysAgo * DAY_MS),
    });
  }

  logger.info(
    { users: SEED_USERS.length, declarations: SEED_DECLARATIONS.length },
    'Database seeded',
  );
  return { skipped: false, users: SEED_USERS.length, declarations: SEED_DECLARATIONS.length };
}
