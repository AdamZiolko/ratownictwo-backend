const db = require("../models");
const ColorConfig = db.colorConfig;
const Session = db.session;

// Create color configuration for a session
exports.createColorConfig = (req, res) => {
  if (!req.body.sessionId || !req.body.colorType || !req.body.soundFileName) {
    res.status(400).send({
      message: "Session ID, color type, and sound file name are required!"
    });
    return;
  }

  const colorConfig = {
    sessionId: req.body.sessionId,
    colorType: req.body.colorType,
    soundFileName: req.body.soundFileName,
    isEnabled: req.body.isEnabled !== undefined ? req.body.isEnabled : true
  };

  ColorConfig.create(colorConfig)
    .then(data => {
      res.send(data);
    })
    .catch(err => {
      res.status(500).send({
        message: err.message || "Some error occurred while creating the color configuration."
      });
    });
};

// Get all color configurations for a session
exports.getColorConfigsBySession = (req, res) => {
  const sessionId = req.params.sessionId;

  ColorConfig.findAll({
    where: { sessionId: sessionId },
    order: [['colorType', 'ASC']]
  })
    .then(data => {
      res.send(data);
    })
    .catch(err => {
      res.status(500).send({
        message: err.message || "Some error occurred while retrieving color configurations."
      });
    });
};

// Update color configuration
exports.updateColorConfig = (req, res) => {
  const id = req.params.id;

  ColorConfig.update(req.body, {
    where: { id: id }
  })
    .then(num => {
      if (num == 1) {
        res.send({
          message: "Color configuration was updated successfully."
        });
      } else {
        res.send({
          message: `Cannot update color configuration with id=${id}. Maybe color configuration was not found or req.body is empty!`
        });
      }
    })
    .catch(err => {
      res.status(500).send({
        message: "Error updating color configuration with id=" + id
      });
    });
};

// Delete color configuration
exports.deleteColorConfig = (req, res) => {
  const id = req.params.id;

  ColorConfig.destroy({
    where: { id: id }
  })
    .then(num => {
      if (num == 1) {
        res.send({
          message: "Color configuration was deleted successfully!"
        });
      } else {
        res.send({
          message: `Cannot delete color configuration with id=${id}. Maybe color configuration was not found!`
        });
      }
    })
    .catch(err => {
      res.status(500).send({
        message: "Could not delete color configuration with id=" + id
      });
    });
};

// Create or update multiple color configurations for a session
exports.setSessionColorConfigs = (req, res) => {
  const sessionId = req.params.sessionId;
  const colorConfigs = req.body.colorConfigs;

  if (!colorConfigs || !Array.isArray(colorConfigs)) {
    res.status(400).send({
      message: "Color configurations array is required!"
    });
    return;
  }

  // First, delete existing configurations for this session
  ColorConfig.destroy({
    where: { sessionId: sessionId }
  })
    .then(() => {
      // Then create new configurations
      const configsToCreate = colorConfigs.map(config => ({
        sessionId: sessionId,
        colorType: config.colorType,
        soundFileName: config.soundFileName,
        isEnabled: config.isEnabled !== undefined ? config.isEnabled : true
      }));

      return ColorConfig.bulkCreate(configsToCreate);
    })
    .then(data => {
      res.send(data);
    })
    .catch(err => {
      res.status(500).send({
        message: err.message || "Some error occurred while setting color configurations."
      });
    });
};
