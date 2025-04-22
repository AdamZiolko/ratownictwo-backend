module.exports = (sequelize, Sequelize) => {  const Session = sequelize.define("sessions", {
    sessionId: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: Sequelize.STRING,
      comment: "Session name"
    },
    temperature: {
      type: Sequelize.FLOAT
    },
    rhythmType: {
      type: Sequelize.SMALLINT  // Zmieniono z TINYINT na SMALLINT
    },
    beatsPerMinute: {
      type: Sequelize.INTEGER
    },
    noiseLevel: {
      type: Sequelize.INTEGER
    },
    sessionCode: {
      type: Sequelize.STRING,
      comment: "Session code as string"
    },
    isActive: {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
      comment: "Flag indicating if session is active"
    },    createdAt: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW,
      comment: "Date when session was created"
    },
    updatedAt: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW,
      comment: "Date when session was last updated"
    },
    // Added medical parameters
    hr: {
      type: Sequelize.INTEGER, // Heart rate, e.g. 80
      comment: "Heart rate in beats per minute"
    },
    bp: {
      type: Sequelize.STRING, // Blood pressure, e.g. "120/80"
      comment: "Blood pressure in mmHg, format: systolic/diastolic"
    },
    spo2: {
      type: Sequelize.INTEGER, // Oxygen saturation, e.g. 95%
      comment: "Oxygen saturation percentage"
    },
    etco2: {
      type: Sequelize.INTEGER, // End-tidal carbon dioxide, e.g. 34
      comment: "End-tidal carbon dioxide level in mmHg"
    },
    rr: {
      type: Sequelize.INTEGER, // Respiratory rate, e.g. 12
      comment: "Respiratory rate in breaths per minute"
    }
  });

  return Session;
};