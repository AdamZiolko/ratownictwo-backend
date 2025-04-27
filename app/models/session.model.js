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
      type: Sequelize.SMALLINT  
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
    hr: {
      type: Sequelize.INTEGER, 
      comment: "Heart rate in beats per minute"
    },
    bp: {
      type: Sequelize.STRING, 
      comment: "Blood pressure in mmHg, format: systolic/diastolic"
    },
    spo2: {
      type: Sequelize.INTEGER, 
      comment: "Oxygen saturation percentage"
    },
    etco2: {
      type: Sequelize.INTEGER, 
      comment: "End-tidal carbon dioxide level in mmHg"
    },
    rr: {
      type: Sequelize.INTEGER, 
      comment: "Respiratory rate in breaths per minute"
    }
  });

  return Session;
};