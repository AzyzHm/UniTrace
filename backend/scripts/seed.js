import { env } from '../src/config/env.js';
import { logger } from '../src/config/logger.js';
import { connectDb, disconnectDb } from '../src/db/connection.js';
import { createDeclarationRepository } from '../src/repositories/declaration.repository.js';
import { createUserRepository } from '../src/repositories/user.repository.js';
import { createPasswordHasher } from '../src/services/password-hasher.js';
import { runSeed } from '../src/seed/run-seed.js';

// Every seeded account shares this password, so it must come from the person
// running the seed. A default written in a public repository would be a known
// admin password on any database where the seed was run.
const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;

async function main() {
  if (env.nodeEnv === 'production') {
    throw new Error('The seed adds test accounts and refuses to run when NODE_ENV=production');
  }

  const password = process.env.SEED_PASSWORD;
  if (!password || !PASSWORD_RULE.test(password)) {
    throw new Error(
      'Set SEED_PASSWORD (8 to 72 characters, at least one letter and one digit) before running the seed',
    );
  }

  await connectDb(env.mongoUri);
  try {
    const result = await runSeed({
      userRepository: createUserRepository(),
      declarationRepository: createDeclarationRepository(),
      passwordHasher: createPasswordHasher(),
      password,
      emailDomain: env.allowedEmailDomains[0],
      logger,
    });
    if (!result.skipped) {
      logger.info(`Log in as admin@${env.allowedEmailDomains[0]} with your SEED_PASSWORD`);
    }
  } finally {
    await disconnectDb();
  }
}

main().catch((err) => {
  logger.error({ err }, 'Seed failed');
  process.exit(1);
});
