// app/models/preset.model.js

module.exports = (sequelize, DataTypes) => {
  const Preset = sequelize.define(
    "Preset",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
     
      data: {
        type: DataTypes.JSONB,
        allowNull: false,
      },
      isDefault: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      tableName: "Presets",
      timestamps: true,
    }
  );
  return Preset;
};
