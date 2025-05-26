module.exports = (sequelize, Sequelize) => {
  const TestResult = sequelize.define("testResult", {
    id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    student: {
      type: Sequelize.JSON,
      allowNull: false
    },
    tasks: {
      type: Sequelize.JSON,
      allowNull: false
    },
    comments: {
      type: Sequelize.JSON,
      defaultValue: []
    },
    userId: {
      type: Sequelize.INTEGER,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    sessionId: {
      type: Sequelize.INTEGER,
      references: {
        model: 'sessions',
        key: 'sessionId' 
      }
    }
  });
  return TestResult;
};
