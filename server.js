require('dotenv').config();

const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const swaggerSpecs = require("./app/config/swagger");
const http = require("http");
const os = require("os");
const bcrypt = require("bcryptjs");

// Import zabezpieczeń
const { securityHeaders, apiLimiter, speedLimiter, corsOptions } = require("./app/middleware/security");
const { sanitizeInput } = require("./app/middleware/validation");
const { globalErrorHandler, notFoundHandler } = require("./app/middleware/errorHandler");
const requestLogger = require("./app/middleware/requestLogger");
const securityLogger = require("./app/middleware/securityLogger");

const app = express();
const server = http.createServer(app);

// BEZPIECZEŃSTWO: Spowolnienie żądań
app.use(speedLimiter);

// BEZPIECZEŃSTWO: Rate limiting
app.use('/api/', apiLimiter);

// BEZPIECZEŃSTWO: Poprawiona konfiguracja CORS
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// Zwiększenie timeout serwera (zachowane dla kompatybilności)
server.timeout = 10 * 60 * 1000; // 10 minut
server.keepAliveTimeout = 10 * 60 * 1000; // 10 minut
server.headersTimeout = 10 * 60 * 1000; // 10 minut

// Dodatkowo ustaw właściwości Keep-Alive
server.on('connection', (socket) => {
  socket.setKeepAlive(true, 60000); // Keep-alive co 60 sekund
  socket.setTimeout(10 * 60 * 1000); // 10 minut timeout
});

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

// BEZPIECZEŃSTWO: HTTPS Enforcement (kontrolowane przez zmienną środowiskową)
const enforceHttps = process.env.ENFORCE_HTTPS === 'true';
if (process.env.NODE_ENV === 'production' && enforceHttps) {
  app.use((req, res, next) => {
    // Sprawdź czy żądanie przychodzi przez HTTPS
    if (req.header('x-forwarded-proto') !== 'https' && req.header('x-forwarded-ssl') !== 'on') {
      return res.redirect(301, `https://${req.header('host')}${req.url}`);
    }
    next();
  });
}

// BEZPIECZEŃSTWO: Sanityzacja danych wejściowych
app.use(sanitizeInput);

// Zmniejszenie limitów dla bezpieczeństwa (było 50MB) z lepszą obsługą błędów JSON
app.use(express.json({ 
  limit: '25mb',
  verify: (req, res, buf, encoding) => {
    try {
      // Store raw body for debugging purposes
      req.rawBody = buf.toString(encoding || 'utf8');
    } catch (err) {
      // If there's an encoding error, log it
      console.error('Error storing raw body:', err);
    }
  }
}));

// Custom error handler for JSON parsing errors
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('JSON Parse Error - Attempting to fix and retry:', {
      url: req.originalUrl,
      method: req.method,
      rawBody: req.rawBody?.substring(0, 200),
      error: err.message
    });
    
    // Try to fix common JSON issues
    if (req.rawBody) {
      let fixedBody = req.rawBody;
      let wasFixed = false;
      
      // Fix escaped quotes
      if (fixedBody.includes('\\"')) {
        fixedBody = fixedBody.replace(/\\"/g, '"');
        wasFixed = true;
      }
      
      // Fix double-encoded JSON
      if (fixedBody.startsWith('"') && fixedBody.endsWith('"')) {
        try {
          const unescaped = JSON.parse(fixedBody);
          if (typeof unescaped === 'string') {
            fixedBody = unescaped;
            wasFixed = true;
          }
        } catch (e) {
          fixedBody = fixedBody.slice(1, -1);
          wasFixed = true;
        }
      }
      
      if (wasFixed) {
        try {
          req.body = JSON.parse(fixedBody);
          console.log('✅ Successfully fixed and parsed JSON');
          return next();
        } catch (parseError) {
          console.error('❌ Could not fix malformed JSON:', parseError.message);
        }
      }
    }
    
    // If we can't fix it, return a clear error
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON format in request body',
      error: 'Please check that your JSON is properly formatted',
      timestamp: new Date().toISOString()
    });
  }
  
  next(err);
});

app.use(express.urlencoded({ 
  extended: true, 
  limit: '25mb',
  parameterLimit: 10000
}));

// Add request logging for debugging JSON parsing issues
app.use(requestLogger);

const db = require("./app/models");
const Role = db.role;
const Preset = db.Preset; 
const User = db.user;

db.sequelize
  .sync({ force: process.env.DB_FORCE_SYNC === 'true' }) 
  .then(async () => {
    console.log("✅ Baza zsynchronizowana (sequelize.sync).");
    await checkRoles();
    await seedDefaultPreset();
    await seedDefaultAdmin();

    // Log security system initialization
    securityLogger.logger.info('Security systems initialized', {
      event: 'SYSTEM_START',
      message: 'Security systems initialized',
      details: {
        nodeEnv: process.env.NODE_ENV,
        jwtAlgorithm: process.env.JWT_ALGORITHM || 'HMAC',
        accountLockoutEnabled: true,
        passwordValidationEnabled: true,
        secureFileUploadEnabled: true,
        httpsEnforced: process.env.ENFORCE_HTTPS === 'true'
      },
      timestamp: new Date().toISOString()
    });
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

// Test endpoint for JSON parsing
app.post("/api/test-json", (req, res) => {
  res.json({
    success: true,
    message: "JSON parsed successfully",
    receivedData: req.body,
    timestamp: new Date().toISOString()
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

// BEZPIECZEŃSTWO: Middleware obsługi błędów (na końcu, po wszystkich route'ach)
app.use(notFoundHandler);
app.use(globalErrorHandler);

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
          name: "Preset domyślny",
          temperature: "36.6",
          rhythmType: 0,              
          beatsPerMinute: "72",
          noiseLevel: "0",         
          sessionCode: "123456",
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


async function seedDefaultAdmin() {
  try {
    const adminUsername = "admin";
    const adminEmail = "admin@gmail.com";
    const rawPassword = process.env.ADMIN_PASSWORD;

    if (!rawPassword) {
      console.warn(
        "⚠️ Nie ustawiono zmiennej ADMIN_PASSWORD w .env – pomijam seed domyślnego admina."
      );
      return;
    }

    const existing = await User.findOne({
      where: {
        [db.Sequelize.Op.or]: [
          { username: adminUsername },
          { email: adminEmail },
        ],
      },
    });

    if (existing) {
      console.log("✓ Domyślny admin już istnieje, pomijam seed.");
      return;
    }

    const hashed = bcrypt.hashSync(rawPassword, 12);

    const newAdmin = await User.create({
      username: adminUsername,
      email: adminEmail,
      password: hashed,
    });

    
    await newAdmin.setRoles([3]);

    console.log("✅ Domyślny admin został utworzony (username: admin).");
  } catch (err) {
    console.error("❌ Błąd podczas seedowania domyślnego admina:", err);
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
