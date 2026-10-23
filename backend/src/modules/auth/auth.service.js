const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const AppError = require("../../common/app-error");
const queries = require("./auth.queries");

async function login(credentials) {
  const user = await queries.findByEmail(credentials.email);
  if (
    !user ||
    !user.is_active ||
    !(await bcrypt.compare(credentials.password, user.password_hash))
  ) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Adresse e-mail ou mot de passe invalide.");
  }
  const token = jwt.sign({ sub: user.id, role: user.role_name }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "8h"
  });
  return {
    token,
    user: {
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      role: user.role_name
    }
  };
}

async function getCurrentUser(id) {
  const user = await queries.findPublicById(id);
  if (!user || !user.is_active)
    throw new AppError(401, "UNAUTHORIZED", "La session n'est plus valide.");
  return user;
}

module.exports = { login, getCurrentUser };
