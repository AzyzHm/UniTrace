export function createAuthService({ userRepository, passwordHasher }) {
  return {
    async register({ username, email, phone, password }) {
      const hashedPassword = await passwordHasher.hash(password);

      // Explicit fields only: role, isActive and the rest keep their model defaults.
      return userRepository.create({
        username,
        email,
        phone,
        password: hashedPassword,
      });
    },
  };
}
