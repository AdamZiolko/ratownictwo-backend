require('dotenv').config();

const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const swaggerSpecs = require("./app/config/swagger");
const http = require("http");
const os = require("os");

const app = express();
const server = http.createServer(app);

// Zwiększenie timeout serwera do 10 minut
server.timeout = 10 * 60 * 1000; // 10 minut
server.keepAliveTimeout = 10 * 60 * 1000; // 10 minut
server.headersTimeout = 10 * 60 * 1000; // 10 minut

// Dodatkowo ustaw właściwości Keep-Alive
server.on('connection', (socket) => {
  socket.setKeepAlive(true, 60000); // Keep-alive co 60 sekund
  socket.setTimeout(10 * 60 * 1000); // 10 minut timeout
});

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.options("*", cors({ origin: true, credentials: true }));

// Middleware dla zwiększenia timeout dla wszystkich żądań
app.use((req, res, next) => {
  // Ustaw timeout na 10 minut dla wszystkich żądań
  req.setTimeout(10 * 60 * 1000);
  res.setTimeout(10 * 60 * 1000);
  
  // Dodaj nagłówki dla Keep-Alive
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Keep-Alive', 'timeout=600, max=1000');
  
  next();
});

// Zwiększenie limitów dla dużych plików
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '50mb',
  parameterLimit: 50000
}));

const db = require("./app/models");
const Role = db.role;
const Preset = db.Preset; 

db.sequelize
  .sync({ force: process.env.DB_FORCE_SYNC === 'true' }) 
  .then(async () => {
    console.log("✅ Baza zsynchronizowana (sequelize.sync).");
    await checkRoles();
    await seedDefaultPreset();
  })
  .catch((err) => {
    console.error("❌ Błąd podczas synchronizacji bazy:", err);
  });

app.get("/", (req, res) => {
  res.json({ message: "Welcome." });
});

// Health check endpoint for mobile connectivity testing
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "OK", 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: "1.0.0"
  });
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpecs, { explorer: true }));

require("./app/routes/auth.routes")(app);
require("./app/routes/user.routes")(app);
require("./app/routes/session.routes")(app);
require("./app/routes/preset.routes")(app);
require("./app/routes/audio.routes")(app);
require("./app/routes/template.routes")(app);
require("./app/routes/testResult.routes")(app);
require("./app/routes/colorConfig.routes")(app);
const socketUtils = require("./app/utils/socket");
socketUtils.init(server);

async function checkRoles() {
  try {
    const count = await Role.count();
    if (count === 0) {
      console.log("Brak ról w bazie – zakładam role początkowe.");
      await initialRoles();
    } else {
      console.log("✓ Role już istnieją, pomijam inicjalizację.");
    }
  } catch (error) {
    console.error("Błąd podczas sprawdzania ról:", error);
  }
}

async function initialRoles() {
  await Role.create({ id: 1, name: "user" });
  await Role.create({ id: 2, name: "moderator" });
  await Role.create({ id: 3, name: "admin" });
}

async function seedDefaultPreset() {
  try {
    const existing = await Preset.findOne({ where: { isDefault: true } });
    if (!existing) {
      console.log("Brak domyślnego presetu – wstawiam przykład.");
      await Preset.create({
        name: "Przykładowy Preset Domyślny",
        data: {
          rhythmType: "4/4",
          beatsPerMinute: 120,
          noiseLevel: "low",
          sessionCode: "000000",
          isActive: true,
          isEkdDisplayHidden: false,
          bp: "120/80",
          spo2: "98",
          etco2: "35",
          rr: "12",
        },
        isDefault: true,
      });
      console.log("✓ Domyślny preset został wstawiony.");
    } else {
      console.log("✓ Domyślny preset już istnieje, pomijam seeding.");
    }
  } catch (err) {
    console.error("Błąd podczas tworzenia domyślnego presetu:", err);
  }
}

app.get("/network-info", (req, res) => {
  const interfaces = os.networkInterfaces();
  const results = {};

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        if (!results[name]) results[name] = [];
        results[name].push(iface.address);
      }
    }
  }

  res.json({
    ip: Object.values(results)[0]?.[0] || "localhost",
    allInterfaces: results,
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, "0.0.0.0", () => {
  console.log("Serwer dostępny pod adresami:");
  console.log(`- http://localhost:${PORT}`);
  console.log(`- http://${getLocalIP()}:${PORT}`);
});

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
}
