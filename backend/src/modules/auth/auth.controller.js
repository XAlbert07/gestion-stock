const service = require("./auth.service");
const { login } = require("./auth.validation");
async function signIn(req, res, next) {
  try {
    res.json(await service.login(login(req.body || {})));
  } catch (error) {
    next(error);
  }
}
async function me(req, res, next) {
  try {
    res.json(await service.getCurrentUser(req.user.sub));
  } catch (error) {
    next(error);
  }
}
async function demoStatus(req, res, next) {
  try {
    res.json(await service.getDemoStatus());
  } catch (error) {
    next(error);
  }
}
async function demoSignIn(req, res, next) {
  try {
    res.json(await service.loginDemo());
  } catch (error) {
    next(error);
  }
}
module.exports = { signIn, me, demoStatus, demoSignIn };
