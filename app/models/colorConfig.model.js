module.exports = (sequelize, Sequelize) => {
  const ColorConfig = sequelize.define(
    "colorConfig",
    {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      sessionId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "sessions",
          key: "sessionId",
        },
      },      color: {
        type: Sequelize.ENUM(
          "red",
          "green",
          "blue",
          "yellow",
          "orange",
          "purple",
          "custom"
        ),
        allowNull: false,
      },
      colorIdentifier: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: "Unique identifier for custom colors (RGB hash) or predefined color name",
      },
      customColorRgb: {
        type: Sequelize.JSON,
        allowNull: true,
        comment:
          "RGB values for custom color detection: {r: number, g: number, b: number}",
      },
      colorTolerance: {
        type: Sequelize.FLOAT,
        defaultValue: 0.15,
        validate: {
          min: 0.05,
          max: 0.5,
        },
        comment: "Color detection tolerance (5-50%)",
      },
      displayName: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: "Display name for the sound shown to user",
      },
      soundName: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: "Local sound file path - if null, use server audio",
      },
      serverAudioId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: "audios",
          key: "id",
        },
        comment: "Server audio file ID - if null, use local sound",
      },
      isEnabled: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      volume: {
        type: Sequelize.FLOAT,
        defaultValue: 1.0,
        validate: {
          min: 0.0,
          max: 1.0,
        },
      },
      isLooping: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
    },    {
      indexes: [
        {
          unique: true,
          fields: ["sessionId", "colorIdentifier"],
          name: "unique_session_color_identifier"
        },
      ],
    }
  );

  return ColorConfig;
};
