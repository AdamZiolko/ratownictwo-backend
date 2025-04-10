const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const swaggerSpecs = require("./app/config/swagger");

const app = express();

var corsOptions = {
  origin: "http://localhost:8081"
};

app.use(cors(corsOptions));

// parse requests of content-type - application/json
app.use(express.json());

// parse requests of content-type - application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));

// database
const db = require("./app/models");
const Role = db.role;

// Synchronizacja modeli z bazą danych z opcją alter: true, która pozwala na aktualizację struktury tabel
db.sequelize.sync({ alter: true }).then(() => {
  console.log('Database synchronized and updated with the latest model changes');
  checkRoles();
});

// simple route
app.get("/", (req, res) => {
  res.json({ message: "Welcome to bezkoder application." });
});

// Swagger documentation route
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpecs, { explorer: true }));

// routes
require('./app/routes/auth.routes')(app);
require('./app/routes/user.routes')(app);
require('./app/routes/session.routes')(app);

// set port, listen for requests
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});

// Check if roles exist, if not create them
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
  Role.create({
    id: 1,
    name: "user"
  });
 
  Role.create({
    id: 2,
    name: "moderator"
  });
 
  Role.create({
    id: 3,
    name: "admin"
  });
}