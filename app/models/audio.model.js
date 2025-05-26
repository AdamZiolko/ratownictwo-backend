module.exports = (sequelize, Sequelize) => {
  const Audio = sequelize.define("audio", {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true
    },
    name: {
      type: Sequelize.STRING,
      allowNull: false
    },
    length: {
      type: Sequelize.STRING,
      allowNull: false
    },
    filepath: {
      type: Sequelize.STRING,
      allowNull: false
    },    createdBy: {
      type: Sequelize.INTEGER,
      allowNull: false
    },
    updatedBy: {
      type: Sequelize.INTEGER,
      allowNull: true
    }
  });

  return Audio;
};