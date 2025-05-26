const { authJwt } = require("../middleware");
const controller = require("../controllers/colorConfig.controller.js");

module.exports = function(app) {
  app.use(function(req, res, next) {
    res.header(
      "Access-Control-Allow-Headers",
      "x-access-token, Origin, Content-Type, Accept"
    );
    next();
  });

  // Create color configuration
  app.post(
    "/api/color-configs",
    [authJwt.verifyToken],
    controller.createColorConfig
  );

  // Get color configurations for a session
  app.get(
    "/api/color-configs/session/:sessionId",
    [authJwt.verifyToken],
    controller.getColorConfigsBySession
  );

  // Update color configuration
  app.put(
    "/api/color-configs/:id",
    [authJwt.verifyToken],
    controller.updateColorConfig
  );

  // Delete color configuration
  app.delete(
    "/api/color-configs/:id",
    [authJwt.verifyToken],
    controller.deleteColorConfig
  );

  // Set all color configurations for a session (replaces existing)
  app.post(
    "/api/color-configs/session/:sessionId",
    [authJwt.verifyToken],
    controller.setSessionColorConfigs
  );
};
