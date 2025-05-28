module.exports = (sequelize, Sequelize) => {
  const ColorConfig = sequelize.define("colorConfig", {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },    sessionId: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'sessions',
        key: 'sessionId'
      }
    },
    color: {
      type: Sequelize.ENUM('red', 'green', 'blue', 'yellow', 'orange', 'purple'),
      allowNull: false
    },
    soundName: {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Local sound file name - if null, use server audio'
    },    serverAudioId: {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'audios',
        key: 'id'
      },
      comment: 'Server audio file ID - if null, use local sound'
    },
    isEnabled: {
      type: Sequelize.BOOLEAN,
      defaultValue: true
    },
    volume: {
      type: Sequelize.FLOAT,
      defaultValue: 1.0,
      validate: {
        min: 0.0,
        max: 1.0
      }
    },
    isLooping: {
      type: Sequelize.BOOLEAN,
      defaultValue: false
    }
  }, {
    indexes: [
      {
        unique: true,
        fields: ['sessionId', 'color']
      }
    ]
  });

  return ColorConfig;
};