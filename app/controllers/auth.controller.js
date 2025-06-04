const db = require("../models");
const config = require("../config/auth.config");
const jwtManager = require("../config/jwt.config");
const passwordValidator = require("../middleware/passwordValidation");
const accountLockout = require("../middleware/accountLockout");
const securityLogger = require("../middleware/securityLogger");
const tokenBlacklist = require("../utils/tokenBlacklist");
const User = db.user;
const RefreshToken = db.refreshToken;

var jwt = require("jsonwebtoken");
var bcrypt = require("bcryptjs");

const createRefreshToken = async (userId) => {
  const refreshToken = jwtManager.generateRefreshToken(userId);
  const expiredAt = new Date();
  expiredAt.setSeconds(expiredAt.getSeconds() + config.jwtRefreshExpiration);

  const existingToken = await RefreshToken.findOne({ where: { userId: userId } });
  
  if (existingToken) {
    existingToken.token = refreshToken;
    existingToken.expiryDate = expiredAt;
    await existingToken.save();
    return existingToken.token;
  } else {
    const newRefreshToken = await RefreshToken.create({
      token: refreshToken,
      userId: userId,
      expiryDate: expiredAt,
    });
    return newRefreshToken.token;
  }
};

exports.signup = async (req, res) => {
  try {
    // Walidacja hasła została już wykonana przez middleware
    const passwordStrength = res.locals.passwordStrength;

    // Sprawdź czy użytkownik już istnieje
    const existingUser = await User.findOne({
      where: {
        [db.Sequelize.Op.or]: [
          { username: req.body.username },
          { email: req.body.email }
        ]
      }
    });

    if (existingUser) {
      securityLogger.logSuspiciousActivity(req, 'DUPLICATE_REGISTRATION_ATTEMPT', {
        username: req.body.username,
        email: req.body.email
      });
      
      return res.status(400).send({ 
        message: "Użytkownik o tej nazwie lub emailu już istnieje!" 
      });
    }

    // Utworz użytkownika z silnym hashowaniem hasła
    const user = await User.create({
      username: req.body.username,
      email: req.body.email,
      password: bcrypt.hashSync(req.body.password, 12) // Zwiększone z 8 do 12 rund
    });

    await user.setRoles([1]);
    
    // Loguj udaną rejestrację
    securityLogger.logger.info('User registered successfully', {
      event: 'USER_REGISTRATION',
      userId: user.id,
      username: user.username,
      email: user.email,
      passwordStrength: passwordStrength,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });
    
    // Nie zwracaj wrażliwych danych
    res.status(201).send({ 
      message: "Użytkownik zarejestrowany pomyślnie!",
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      },
      passwordStrength: passwordStrength
    });
  } catch (err) {
    console.error('Błąd rejestracji:', err);
    securityLogger.logger.error('Registration error', {
      event: 'REGISTRATION_ERROR',
      error: err.message,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });
    res.status(500).send({ message: "Błąd wewnętrzny serwera" });
  }
};

exports.signin = async (req, res) => {
  try {
    const clientIP = req.ip || req.connection.remoteAddress;
    const loginIdentifier = req.body.username || req.body.email;
    
    if (!loginIdentifier) {
      return res.status(400).send({ message: "Nazwa użytkownika lub email jest wymagany." });
    }

    // Sprawdź blokadę konta używając nowego systemu
    try {
      await accountLockout.checkLockout(clientIP);
    } catch (lockoutError) {
      securityLogger.logFailedLogin(req, {
        username: loginIdentifier,
        reason: 'ACCOUNT_LOCKED',
        ip: clientIP
      });
      
      return res.status(429).send({ 
        message: lockoutError.message
      });
    }

    let condition = {};
    
    if (loginIdentifier.includes('@')) {
      condition = { email: loginIdentifier };
    } else {
      condition = { username: loginIdentifier };
    }

    const user = await User.findOne({
      where: condition
    });

    if (!user) {
      // Zwiększ licznik nieudanych prób
      const attemptInfo = await accountLockout.recordFailedAttempt(clientIP);
      
      securityLogger.logFailedLogin(req, {
        username: loginIdentifier,
        reason: 'USER_NOT_FOUND',
        attemptNumber: attemptInfo.attempts,
        remainingAttempts: attemptInfo.remainingAttempts
      });
      
      return res.status(404).send({ 
        message: "Nieprawidłowe dane logowania.",
        remainingAttempts: attemptInfo.remainingAttempts
      });
    }

    var passwordIsValid = bcrypt.compareSync(
      req.body.password,
      user.password
    );

    if (!passwordIsValid) {
      // Zwiększ licznik nieudanych prób
      const attemptInfo = await accountLockout.recordFailedAttempt(clientIP);
      
      securityLogger.logFailedLogin(req, {
        username: loginIdentifier,
        userId: user.id,
        reason: 'INVALID_PASSWORD',
        attemptNumber: attemptInfo.attempts,
        remainingAttempts: attemptInfo.remainingAttempts
      });

      return res.status(401).send({
        message: "Nieprawidłowe dane logowania.",
        remainingAttempts: attemptInfo.remainingAttempts
      });
    }

    // Wyczyść nieudane próby po udanym logowaniu
    await accountLockout.clearFailedAttempts(clientIP);

    // Generuj nowy token używając nowego systemu JWT
    const token = jwtManager.generateToken({
      id: user.id,
      username: user.username,
      email: user.email
    }, `${config.jwtExpiration}s`);

    let authorities = [];
    const roles = await user.getRoles();
    for (let i = 0; i < roles.length; i++) {
      authorities.push("ROLE_" + roles[i].name.toUpperCase());
    }

    const refreshToken = await createRefreshToken(user.id);

    // Loguj udane logowanie
    securityLogger.logSuccessfulLogin(req, user.id, {
      username: user.username,
      roles: authorities
    });

    res.status(200).send({
      id: user.id,
      username: user.username,
      email: user.email,
      roles: authorities,
      accessToken: token,
      refreshToken: refreshToken,
      expiresIn: config.jwtExpiration    });
    
  } catch (err) {
    console.error('Błąd logowania:', err);
    securityLogger.logger.error('Login error', {
      event: 'LOGIN_ERROR',
      error: err.message,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });
    res.status(500).send({ message: "Błąd wewnętrzny serwera" });
  }
};

exports.refreshToken = async (req, res) => {
  const { refreshToken: requestToken } = req.body;

  if (!requestToken) {
    securityLogger.logSecurityViolation(req, 'MISSING_REFRESH_TOKEN');
    return res.status(403).json({ message: "Token odświeżania jest wymagany!" });
  }

  try {
    // Weryfikuj refresh token używając nowego systemu
    const decoded = jwtManager.verifyRefreshToken(requestToken);
    
    const refreshToken = await RefreshToken.findOne({ where: { token: requestToken } });

    if (!refreshToken) {
      securityLogger.logSecurityViolation(req, 'INVALID_REFRESH_TOKEN', {
        token: requestToken.substring(0, 20) + '...'
      });
      return res.status(403).json({ message: "Nie znaleziono tokenu odświeżania!" });
    }

    if (refreshToken.expiryDate.getTime() < new Date().getTime()) {
      await RefreshToken.destroy({ where: { token: requestToken } });
      securityLogger.logTokenRevocation(req, decoded.jti, decoded.userId, {
        reason: 'TOKEN_EXPIRED'
      });
      return res.status(403).json({
        message: "Token odświeżania wygasł. Zaloguj się ponownie!",
      });
    }

    const user = await User.findByPk(decoded.userId);
    if (!user) {
      await RefreshToken.destroy({ where: { token: requestToken } });
      securityLogger.logSecurityViolation(req, 'REFRESH_TOKEN_USER_NOT_FOUND', {
        userId: decoded.userId
      });
      return res.status(403).json({ message: "Nie znaleziono użytkownika!" });
    }

    // Wygeneruj nowy access token
    const newAccessToken = jwtManager.generateToken({
      id: user.id,
      username: user.username,
      email: user.email
    }, `${config.jwtExpiration}s`);

    // Loguj odświeżenie tokenu
    securityLogger.logTokenRefresh(req, user.id, {
      username: user.username
    });

    return res.status(200).json({
      accessToken: newAccessToken,
      refreshToken: requestToken,      expiresIn: config.jwtExpiration
    });

  } catch (err) {
    securityLogger.logSecurityViolation(req, 'REFRESH_TOKEN_VERIFICATION_FAILED', {
      error: err.message
    });
    return res.status(403).json({ message: "Nieprawidłowy token odświeżania!" });
  }
};

exports.logout = async (req, res) => {
  try {
    const { refreshToken: requestToken } = req.body;
    const userId = req.userId; // Dodane przez middleware uwierzytelniania

    if (requestToken) {
      // Usuń refresh token z bazy danych
      await RefreshToken.destroy({ where: { token: requestToken } });
    }    // Dodaj access token do blacklisty
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const accessToken = authHeader.substring(7);
      try {
        const decoded = jwtManager.verifyToken(accessToken);
        await tokenBlacklist.addToken(accessToken, decoded.exp);
      } catch (error) {
        console.warn('Nie udało się dodać tokena do blacklisty:', error.message);
      }
    }

    // Loguj wylogowanie
    securityLogger.logLogout(req, userId, {
      hasRefreshToken: !!requestToken
    });

    res.status(200).send({ message: "Wylogowano pomyślnie!" });
  } catch (err) {
    console.error('Błąd wylogowania:', err);
    securityLogger.logger.error('Logout error', {
      event: 'LOGOUT_ERROR',
      error: err.message,
      userId: req.userId,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });
    res.status(500).send({ message: "Błąd wewnętrzny serwera" });
  }
};