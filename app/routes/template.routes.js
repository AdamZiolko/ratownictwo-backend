const { authJwt } = require("../middleware");
const controller = require("../controllers/template.controller");

module.exports = function(app) {
  app.use(function(req, res, next) {
    res.header(
      "Access-Control-Allow-Headers",
      "x-access-token, Origin, Content-Type, Accept"
    );
    next();
  });

app.post(
  "/api/checklist/templates",
  [authJwt.verifyToken],
  controller.createTemplate
);
app.get(
  "/api/checklist/templates",
  [authJwt.verifyToken],
  controller.getAllTemplates
);
};