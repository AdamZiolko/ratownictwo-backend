// server.js
const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const swaggerSpecs = require("./app/config/swagger");
const http = require("http");
const os = require("os");

const app = express();
const server = http.createServer(app);

// Ustawienie CORS
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.options("*", cors({ origin: true, credentials: true }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ------------------ IMPORT MODELI ------------------
const db = require("./app/models");
const Role = db.role;
const Preset = db.Preset; // <— Tutaj definiujemy model Preset

// ------------------ SYNCHRONIZACJA BAZY ------------------
db.sequelize
  .sync({ force: true }) // na potrzeby pierwszego seedowania robimy force: true; w produkcji ustaw na false
  .then(async () => {
    console.log("✅ Baza zsynchronizowana (sequelize.sync).");
    await checkRoles();
    await seedDefaultPreset();
  })
  .catch((err) => {
    console.error("❌ Błąd podczas synchronizacji bazy:", err);
  });

// ------------------ ROUTES ------------------
app.get("/", (req, res) => {
  res.json({ message: "Welcome." });
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpecs, { explorer: true }));

require("./app/routes/auth.routes")(app);
require("./app/routes/user.routes")(app);
require("./app/routes/session.routes")(app);
require("./app/routes/preset.routes")(app);

// ------------------ SOCKET.IO ------------------
const socketUtils = require("./app/utils/socket");
socketUtils.init(server);

// ------------------ SEED ROLEI ------------------
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

// ------------------ SEED DOMYŚLNYCH PRESETÓW ------------------
async function seedDefaultPreset() {
  try {
    // Sprawdź, czy w bazie już istnieje preset z isDefault = true
    const existing = await Preset.findOne({ where: { isDefault: true } });
    if (!existing) {
      console.log("Brak domyślnego presetu – wstawiam przykład.");
      await Preset.create({
        name: "Przykładowy Preset Domyślny",
        data: {
          // dowolny obiekt JSON (przykładowe pola)
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

// ------------------ ENDPOINT Z SIECIĄ ------------------
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

// ------------------ START SERWERA ------------------
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
