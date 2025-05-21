
module.exports = app => {
  const presetController = require("../controllers/preset.controller");

  const router = require("express").Router();

  router.get("/api/presets/default", presetController.getDefaultPresets);


  app.use("/", router);
};
