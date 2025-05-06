const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const swaggerSpecs = require("./app/config/swagger");
const http = require("http");

const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: true,
  credentials: true
}));
app.options("*", cors({ origin: true, credentials: true }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const db = require("./app/models");
const Role = db.role;

db.sequelize.sync({ force: false })
  .then(() => {
    console.log('Database synchronized and updated with the latest model changes');
    checkRoles();
  });

app.get("/", (req, res) => {
  res.json({ message: "Welcome." });
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpecs, { explorer: true }));

require('./app/routes/auth.routes')(app);
require('./app/routes/user.routes')(app);
require('./app/routes/session.routes')(app);

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on 0.0.0.0:${PORT}`);
});

const socketUtils = require('./app/utils/socket');
socketUtils.init(server);

async function checkRoles() {
  try {
    const count = await Role.count();
    if (count === 0) {
      console.log('No roles found, initializing roles...');
      initial();
    } else {
      console.log('Roles already exist, skipping initialization');
    }
  } catch (error) {
    console.error('Error checking roles:', error);
  }
}

function initial() {
  Role.create({ id: 1, name: "user" });
  Role.create({ id: 2, name: "moderator" });
  Role.create({ id: 3, name: "admin" });
}
