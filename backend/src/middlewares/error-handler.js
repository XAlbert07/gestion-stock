function errorHandler(error, req, res, next) {
  const isExpectedError =
    Number.isInteger(error.status) && error.status >= 400 && error.status < 500;
  const status = isExpectedError ? error.status : 500;
  const code = isExpectedError ? error.code : "INTERNAL_ERROR";

  if (status >= 500) {
    console.error(error);
  }

  res.status(status).json({
    error: {
      code,
      message: isExpectedError ? error.message : "Une erreur interne est survenue.",
      ...(isExpectedError && error.details ? { details: error.details } : {})
    }
  });
}

module.exports = errorHandler;
