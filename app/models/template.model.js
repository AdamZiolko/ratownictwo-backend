// models/template.model.js
module.exports = (sequelize, Sequelize) => {
  const Template = sequelize.define("template", {
    id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: Sequelize.STRING,
      allowNull: false
    },
    tasks: {
      type: Sequelize.JSON,
      allowNull: false
    },
    userId: {
      type: Sequelize.INTEGER, 
      references: {
        model: 'users',
        key: 'id'
      }
    }
  });
  return Template;
};
