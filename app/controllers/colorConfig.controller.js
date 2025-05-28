const db = require("../models");
const ColorConfig = db.colorConfig;
const Session = db.session;
const AudioFile = db.audioFile;
const socketUtils = require("../utils/socket");

/**
 * Helper function to get all color configurations for a session
 */
async function getAllColorConfigsForSession(sessionId) {
  return await ColorConfig.findAll({
    where: { sessionId },
    include: [{
      model: AudioFile,
      as: 'serverAudio',
      required: false
    }],
    order: [['color', 'ASC']]
  });
}

/**
 * Helper function to emit complete color config list to session
 */
async function emitColorConfigUpdate(sessionId) {
  try {
    const colorConfigs = await getAllColorConfigsForSession(sessionId);
    socketUtils.emitToSession(sessionId, 'color-config-list-update', {
      sessionId,
      colorConfigs
    });
    console.log(`✅ Emitted complete color config list for session ${sessionId}:`, colorConfigs.length, 'configs');
  } catch (error) {
    console.error('❌ Error emitting color config update:', error);
  }
}

/**
 * Get all color configurations for a session
 */
exports.getColorConfigs = async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Check if session exists and user has access
    const session = await Session.findOne({
      where: { sessionId },
      include: [{
        model: db.user,
        where: { id: req.userId }
      }]
    });

    if (!session) {
      return res.status(404).json({ message: "Session not found or access denied" });
    }    const colorConfigs = await getAllColorConfigsForSession(sessionId);

    res.status(200).json({ colorConfigs });
  } catch (error) {
    console.error("Error fetching color configurations:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Get all color configurations for a session - for students (no auth required)
 */
exports.getColorConfigsForStudent = async (req, res) => {
  try {
    const { sessionId } = req.params; // This is actually sessionCode from the URL

    // Check if session exists by sessionCode
    const session = await Session.findOne({
      where: { sessionCode: sessionId } // Use sessionCode instead of sessionId
    });

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }    const colorConfigs = await getAllColorConfigsForSession(session.sessionId);

    res.status(200).json({ colorConfigs });
  } catch (error) {
    console.error("Error fetching color configurations for student:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Create or update a color configuration
 */
exports.saveColorConfig = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { color, soundName, serverAudioId, isEnabled = true, volume = 1.0, isLooping = false, id } = req.body;

    // Validate required fields
    if (!color) {
      return res.status(400).json({ message: "Color is required" });
    }

    // Check if session exists and user has access
    const session = await Session.findOne({
      where: { sessionId },
      include: [{
        model: db.user,
        where: { id: req.userId }
      }]
    });

    if (!session) {
      return res.status(404).json({ message: "Session not found or access denied" });
    }

    // If serverAudioId is provided, verify it exists
    if (serverAudioId) {
      const audioFile = await AudioFile.findByPk(serverAudioId);
      if (!audioFile) {
        return res.status(400).json({ message: "Server audio file not found" });
      }
    }

    let colorConfig;
    let created = false;

    if (id) {
      // Update existing configuration by ID
      colorConfig = await ColorConfig.findOne({
        where: { id, sessionId }
      });

      if (!colorConfig) {
        return res.status(404).json({ message: "Color configuration not found" });
      }

      // Check if the new color conflicts with another existing config
      if (colorConfig.color !== color) {
        const conflictingConfig = await ColorConfig.findOne({
          where: { sessionId, color }
        });
        
        if (conflictingConfig) {
          return res.status(400).json({ message: "A configuration with this color already exists" });
        }
      }

      await colorConfig.update({
        color,
        soundName,
        serverAudioId,
        isEnabled,
        volume,
        isLooping
      });
    } else {
      // Create new configuration
      const [newConfig, wasCreated] = await ColorConfig.findOrCreate({
        where: { sessionId, color },
        defaults: {
          soundName,
          serverAudioId,
          isEnabled,
          volume,
          isLooping
        }
      });

      if (!wasCreated) {
        return res.status(400).json({ message: "A configuration with this color already exists" });
      }

      colorConfig = newConfig;
      created = true;
    }// Get the updated config with audio file details
    const updatedConfig = await ColorConfig.findOne({
      where: { id: colorConfig.id },
      include: [{
        model: AudioFile,
        as: 'serverAudio',
        required: false
      }]
    });

    // Emit complete color config list for real-time updates
    await emitColorConfigUpdate(sessionId);

    res.status(created ? 201 : 200).json({ 
      message: created ? "Color configuration created successfully" : "Color configuration updated successfully",
      colorConfig: updatedConfig
    });
  } catch (error) {
    console.error("Error saving color configuration:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Delete a color configuration
 */
exports.deleteColorConfig = async (req, res) => {
  try {
    const { sessionId, color } = req.params;

    // Check if session exists and user has access
    const session = await Session.findOne({
      where: { sessionId },
      include: [{
        model: db.user,
        where: { id: req.userId }
      }]
    });

    if (!session) {
      return res.status(404).json({ message: "Session not found or access denied" });
    }

    const deleted = await ColorConfig.destroy({
      where: { sessionId, color }
    });    if (deleted === 0) {
      return res.status(404).json({ message: "Color configuration not found" });
    }

    // Emit complete color config list for real-time updates
    await emitColorConfigUpdate(sessionId);

    res.status(200).json({ message: "Color configuration deleted successfully" });
  } catch (error) {
    console.error("Error deleting color configuration:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Bulk update color configurations
 */
exports.bulkUpdateColorConfigs = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { colorConfigs } = req.body;

    if (!Array.isArray(colorConfigs)) {
      return res.status(400).json({ message: "colorConfigs must be an array" });
    }

    // Check if session exists and user has access
    const session = await Session.findOne({
      where: { sessionId },
      include: [{
        model: db.user,
        where: { id: req.userId }
      }]
    });

    if (!session) {
      return res.status(404).json({ message: "Session not found or access denied" });
    }

    const updatedConfigs = [];

    for (const config of colorConfigs) {
      const { color, soundName, serverAudioId, isEnabled = true, volume = 1.0, isLooping = false } = config;

      if (!color) {
        continue; // Skip invalid configs
      }

      // If serverAudioId is provided, verify it exists
      if (serverAudioId) {
        const audioFile = await AudioFile.findByPk(serverAudioId);
        if (!audioFile) {
          continue; // Skip configs with invalid serverAudioId
        }
      }

      const [colorConfig, created] = await ColorConfig.findOrCreate({
        where: { sessionId, color },
        defaults: {
          soundName,
          serverAudioId,
          isEnabled,
          volume,
          isLooping
        }
      });

      if (!created) {
        await colorConfig.update({
          soundName,
          serverAudioId,
          isEnabled,
          volume,
          isLooping
        });
      }

      // Get the updated config with audio file details
      const updatedConfig = await ColorConfig.findOne({
        where: { id: colorConfig.id },
        include: [{
          model: AudioFile,
          as: 'serverAudio',
          required: false
        }]
      });      updatedConfigs.push(updatedConfig);
    }

    // Emit complete color config list for real-time updates
    await emitColorConfigUpdate(sessionId);

    res.status(200).json({ 
      message: "Color configurations updated successfully",
      colorConfigs: updatedConfigs
    });
  } catch (error) {
    console.error("Error bulk updating color configurations:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Toggle color configuration enabled status
 */
exports.toggleColorConfig = async (req, res) => {
  try {
    const { sessionId, color } = req.params;
    const { isEnabled } = req.body;

    // Check if session exists and user has access
    const session = await Session.findOne({
      where: { sessionId },
      include: [{
        model: db.user,
        where: { id: req.userId }
      }]
    });

    if (!session) {
      return res.status(404).json({ message: "Session not found or access denied" });
    }

    const colorConfig = await ColorConfig.findOne({
      where: { sessionId, color }
    });

    if (!colorConfig) {
      return res.status(404).json({ message: "Color configuration not found" });
    }

    await colorConfig.update({ isEnabled });    // Get the updated config with audio file details
    const updatedConfig = await ColorConfig.findOne({
      where: { id: colorConfig.id },
      include: [{
        model: AudioFile,
        as: 'serverAudio',
        required: false
      }]
    });

    // Emit complete color config list for real-time updates
    await emitColorConfigUpdate(sessionId);

    res.status(200).json({ 
      message: "Color configuration toggled successfully",
      colorConfig: updatedConfig
    });
  } catch (error) {
    console.error("Error toggling color configuration:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};