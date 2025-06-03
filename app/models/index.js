const config = require("../config/db.config.js");

const Sequelize = require("sequelize");
const sequelize = new Sequelize(
  config.DB,
  config.USER,
  config.PASSWORD,
  {
    host: config.HOST,
    port: config.PORT,
    dialect: config.dialect,
    pool: {
      max: config.pool.max,
      min: config.pool.min,
      acquire: config.pool.acquire,
      idle: config.pool.idle
    }
  }
);

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

db.user = require("../models/user.model.js")(sequelize, Sequelize);
db.role = require("../models/role.model.js")(sequelize, Sequelize);
db.refreshToken = require("../models/refreshToken.model.js")(sequelize, Sequelize);
db.session = require("../models/session.model.js")(sequelize, Sequelize);
db.student = require("../models/student.model.js")(sequelize, Sequelize);
db.studentSession = require("../models/studentSession.model.js")(sequelize, Sequelize);
db.Preset = require("./preset.model.js")(sequelize, Sequelize);
db.audio = require("./audio.model.js")(sequelize, Sequelize);
db.audioFile = require("./audio.model.js")(sequelize, Sequelize); // Alias for consistency
db.template = require("./template.model.js")(sequelize, Sequelize);
db.testResult = require("./testResult.model.js")(sequelize, Sequelize);
db.colorConfig = require("./colorConfig.model.js")(sequelize, Sequelize);

db.role.belongsToMany(db.user, {
  through: "user_roles"
});
db.user.belongsToMany(db.role, {
  through: "user_roles"
});

db.refreshToken.belongsTo(db.user, {
  foreignKey: 'userId', targetKey: 'id'
});
db.user.hasOne(db.refreshToken, {
  foreignKey: 'userId', targetKey: 'id'
});

db.session.belongsTo(db.user, {
  foreignKey: 'userId', targetKey: 'id'
});
db.user.hasMany(db.session, {
  foreignKey: 'userId', targetKey: 'id'
});

db.student.belongsToMany(db.session, {
  through: db.studentSession,
  foreignKey: 'studentId',
  otherKey: 'sessionId'
});

db.session.belongsToMany(db.student, {
  through: db.studentSession,
  foreignKey: 'sessionId',
  otherKey: 'studentId'
});

db.audio.belongsTo(db.user, {
  foreignKey: 'createdBy',
  as: 'creator'
});

db.audio.belongsTo(db.user, {
  foreignKey: 'updatedBy',
  as: 'updater'
});

db.user.hasMany(db.audio, {
  foreignKey: 'createdBy',
  as: 'createdAudios'
});

Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.template.belongsTo(db.user, {
  foreignKey: 'userId',
  as: 'user'
});

db.testResult.belongsTo(db.user, {
  foreignKey: 'userId',
  as: 'user'
});

db.testResult.belongsTo(db.session, {
  foreignKey: 'sessionId',
  onDelete: 'SET NULL',
  as: 'session'
});

db.ROLES = ["user", "admin", "moderator"];

db.testResult.belongsTo(db.session, {
  foreignKey: 'sessionId',
  onDelete: 'SET NULL',
  as: 'testSession' 
});

db.testResult.belongsTo(db.user, {
  foreignKey: 'userId',
  as: 'testUser' 
});

db.session.hasMany(db.testResult, {
  foreignKey: 'sessionId',
  as: 'testResults'
});

db.user.hasMany(db.testResult, {
  foreignKey: 'userId',
  as: 'testResults'
});

// Color configuration relationships
db.colorConfig.belongsTo(db.session, {
  foreignKey: 'sessionId',
  as: 'session'
});

db.session.hasMany(db.colorConfig, {
  foreignKey: 'sessionId',
  as: 'colorConfigs'
});

db.colorConfig.belongsTo(db.audio, {
  foreignKey: 'serverAudioId',
  as: 'serverAudio'
});

db.audio.hasMany(db.colorConfig, {
  foreignKey: 'serverAudioId',
  as: 'colorConfigs'
});

module.exports = db;