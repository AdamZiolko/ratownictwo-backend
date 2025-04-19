module.exports = (sequelize, Sequelize) => {
  const Session = sequelize.define("sessions", {
    sessionId: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true
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
      type: Sequelize.INTEGER
    }
  });

  return Session;
};