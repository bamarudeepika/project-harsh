function body(field, validate, message) {
  return (req, res, next) => {
    if (!req._validationErrors) req._validationErrors = [];
    if (!validate(req.body?.[field])) req._validationErrors.push(message);
    next();
  };
}
function validationResult(req) { return req._validationErrors || []; }
module.exports = { body, validationResult };
