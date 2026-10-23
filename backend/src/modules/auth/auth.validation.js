const AppError = require("../../common/app-error");

function login(payload) {
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const password = typeof payload.password === "string" ? payload.password : "";
  if (!email || !email.includes("@") || !password)
    throw new AppError(400, "VALIDATION_ERROR", "L'adresse e-mail et le mot de passe sont requis.");
  return { email, password };
}

module.exports = { login };
