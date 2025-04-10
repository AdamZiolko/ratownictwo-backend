module.exports = (sequelize, Sequelize) => {
  const Session = sequelize.define("sessions", {
    session_id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    temperature: {
      type: Sequelize.INTEGER
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
    session_code: {
      type: Sequelize.INTEGER
    }
  });

  return Session;
};