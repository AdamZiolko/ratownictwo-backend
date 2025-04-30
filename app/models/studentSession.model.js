module.exports = (sequelize, Sequelize) => {
  const StudentSession = sequelize.define("student_sessions", {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    studentId: {
      type: Sequelize.INTEGER,
      references: {
        model: 'students',
        key: 'id'
      }
    },
    sessionId: {
      type: Sequelize.INTEGER,
      references: {
        model: 'sessions',
        key: 'id'
      }
    },
    joinedAt: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW
    },
    active: {
      type: Sequelize.BOOLEAN,
      defaultValue: true
    }
  });

  return StudentSession;
};
