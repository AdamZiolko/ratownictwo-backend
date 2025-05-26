const { authJwt } = require("../middleware");
const controller = require("../controllers/testResult.controller");

module.exports = function(app) {
  app.use(function(req, res, next) {
    res.header(
      "Access-Control-Allow-Headers",
      "x-access-token, Origin, Content-Type, Accept"
    );
    next();
  });

 app.post(
  "/api/checklist/test-results",
  [authJwt.verifyToken],
  controller.createTestResult
  );
  app.get(
  "/api/checklist/test-results",
  [authJwt.verifyToken],
  controller.getAllTestResults
);
};