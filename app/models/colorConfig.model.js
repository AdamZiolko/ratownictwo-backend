module.exports = (sequelize, Sequelize) => {
  const ColorConfig = sequelize.define("color_configs", {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    sessionId: {
      type: Sequelize.INTEGER,
      allowNull: false,
      comment: "ID of the session this color configuration belongs to"
    },
    colorType: {
      type: Sequelize.ENUM('red', 'green', 'blue'),
      allowNull: false,
      comment: "Type of color (red, green, blue)"
    },
    soundFileName: {
      type: Sequelize.STRING,
      allowNull: false,
      comment: "Name of the sound file to play for this color"
    },
    isEnabled: {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
      comment: "Whether this color configuration is enabled"
    },
    createdAt: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW,
      comment: "Date when color config was created"
    },
    updatedAt: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW,
      comment: "Date when color config was last updated"
    }
  });

  return ColorConfig;
};
