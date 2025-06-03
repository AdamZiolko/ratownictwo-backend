
module.exports = app => {
  const presetController = require("../controllers/preset.controller");

  const router = require("express").Router();

  router.get("/api/presets/default", presetController.getDefaultPresets);
  router.delete("/api/presets/default/:id", presetController.deleteDefaultPreset);
  router.post("/api/presets/default", presetController.createDefaultPreset);


  app.use("/", router);
};
