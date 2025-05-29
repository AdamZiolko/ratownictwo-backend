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
    const { 
      color, 
      soundName, 
      displayName,
      serverAudioId, 
      isEnabled = true, 
      volume = 1.0, 
      isLooping = false, 
      customColorRgb,
      colorTolerance = 0.15,
      id 
    } = req.body;

    // Validate required fields
    if (!color) {
      return res.status(400).json({ message: "Color is required" });
    }

    // Validate custom color fields
    if (color === 'custom') {
      if (!customColorRgb || typeof customColorRgb.r !== 'number' || typeof customColorRgb.g !== 'number' || typeof customColorRgb.b !== 'number') {
        return res.status(400).json({ message: "Dla custom koloru wymagane są wartości RGB" });
      }
      if (customColorRgb.r < 0 || customColorRgb.g < 0 || customColorRgb.b < 0) {
        return res.status(400).json({ message: "Wartości RGB muszą być nieujemne" });
      }
    }

    // Validate tolerance
    if (colorTolerance < 0.05 || colorTolerance > 0.5) {
      return res.status(400).json({ message: "Tolerancja musi być między 5% a 50%" });
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

    // Generate color identifier
    let colorIdentifier;
    if (color === 'custom') {
      // For custom colors, create a unique identifier based on RGB values
      colorIdentifier = `custom_${customColorRgb.r}_${customColorRgb.g}_${customColorRgb.b}`;
    } else {
      // For predefined colors, use the color name as identifier
      colorIdentifier = color;
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

      // Check if the new colorIdentifier conflicts with another existing config
      if (colorConfig.colorIdentifier !== colorIdentifier) {
        const conflictingConfig = await ColorConfig.findOne({
          where: { 
            sessionId, 
            colorIdentifier,
            id: { [db.Sequelize.Op.ne]: id } // Exclude current config
          }
        });
        
        if (conflictingConfig) {
          if (color === 'custom') {
            return res.status(400).json({ message: "Konfiguracja z tymi wartościami RGB już istnieje" });
          } else {
            return res.status(400).json({ message: "Konfiguracja z tym kolorem już istnieje" });
          }
        }
      }

      await colorConfig.update({
        color,
        colorIdentifier,
        soundName,
        displayName,
        serverAudioId,
        isEnabled,
        volume,
        isLooping,
        customColorRgb,
        colorTolerance
      });
    } else {
      // Check if a configuration with this colorIdentifier already exists
      const existingConfig = await ColorConfig.findOne({
        where: { sessionId, colorIdentifier }
      });

      if (existingConfig) {
        if (color === 'custom') {
          return res.status(400).json({ message: "Konfiguracja z tymi wartościami RGB już istnieje" });
        } else {
          return res.status(400).json({ message: "Konfiguracja z tym kolorem już istnieje" });
        }
      }

      // Create new configuration
      colorConfig = await ColorConfig.create({
        sessionId,
        color,
        colorIdentifier,
        soundName,
        displayName,
        serverAudioId,
        isEnabled,
        volume,
        isLooping,
        customColorRgb,
        colorTolerance      });
      created = true;
    }

    // Get the updated config with audio file details
    const updatedConfig = await ColorConfig.findOne({
      where: { id: colorConfig.id },
      include: [{
        model: AudioFile,
        as: 'serverAudio',
        required: false
      }]
    });

    // Emit complete color config list for real-time updates
    await emitColorConfigUpdate(sessionId);    res.status(created ? 201 : 200).json({ 
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
    const { sessionId, id } = req.params;

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
      where: { sessionId, id }
    });

    if (deleted === 0) {
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

    const updatedConfigs = [];    for (const config of colorConfigs) {
      const { 
        id,
        color, 
        soundName, 
        serverAudioId, 
        isEnabled = true, 
        volume = 1.0, 
        isLooping = false,
        customColorRgb,
        colorTolerance = 0.15
      } = config;

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

      // Generate color identifier
      let colorIdentifier;
      if (color === 'custom') {
        if (!customColorRgb) continue; // Skip custom colors without RGB values
        colorIdentifier = `custom_${customColorRgb.r}_${customColorRgb.g}_${customColorRgb.b}`;
      } else {
        colorIdentifier = color;
      }

      let colorConfig;

      if (id) {
        // Update existing config by ID
        colorConfig = await ColorConfig.findOne({
          where: { id, sessionId }
        });

        if (colorConfig) {
          await colorConfig.update({
            color,
            colorIdentifier,
            soundName,
            serverAudioId,
            isEnabled,
            volume,
            isLooping,
            customColorRgb,
            colorTolerance
          });
        }
      } else {
        // Check if configuration with this colorIdentifier already exists
        const existingConfig = await ColorConfig.findOne({
          where: { sessionId, colorIdentifier }
        });

        if (existingConfig) {
          // Update existing config
          await existingConfig.update({
            soundName,
            serverAudioId,
            isEnabled,
            volume,
            isLooping,
            customColorRgb,
            colorTolerance
          });
          colorConfig = existingConfig;
        } else {
          // Create new config
          colorConfig = await ColorConfig.create({
            sessionId,
            color,
            colorIdentifier,
            soundName,
            serverAudioId,
            isEnabled,
            volume,
            isLooping,
            customColorRgb,
            colorTolerance
          });
        }
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
    const { sessionId, id } = req.params;
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
      where: { sessionId, id }
    });

    if (!colorConfig) {
      return res.status(404).json({ message: "Color configuration not found" });
    }

    await colorConfig.update({ isEnabled });

    // Get the updated config with audio file details
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