const jwt = require("jsonwebtoken");
const config = require("../config/auth.config.js");
const jwtManager = require("../config/jwt.config");
const securityLogger = require("./securityLogger");
const tokenBlacklist = require("../utils/tokenBlacklist");
const db = require("../models");
const User = db.user;
const RefreshToken = db.refreshToken;

verifyToken = async (req, res, next) => {
  let token = req.headers["x-access-token"];

  const authHeader = req.headers["authorization"];
  if (!token && authHeader) {
    const bearerToken = authHeader.split(' ')[1];
    if (bearerToken) {
      token = bearerToken;
    }
  }

  if (!token) {
    securityLogger.logUnauthorizedAccess(req, {
      reason: 'NO_TOKEN_PROVIDED'
    });
    return res.status(403).send({
      message: "No token provided!"
    });
  }
  try {
    // Sprawdź czy token nie jest na blackliście
    if (await tokenBlacklist.isTokenBlacklisted(token)) {
      securityLogger.logUnauthorizedAccess(req, {
        reason: 'TOKEN_BLACKLISTED',
        token: token.substring(0, 20) + '...'
      });
      return res.status(401).send({
        message: "Token has been revoked!"
      });
    }
    
    // Użyj nowego systemu JWT
    const decoded = jwtManager.verifyToken(token);
    
    req.userId = decoded.id;
    req.user = {
      id: decoded.id,
      username: decoded.username,
      email: decoded.email
    };
    req.tokenId = decoded.jti;
    
    next();
  } catch (err) {
    securityLogger.logUnauthorizedAccess(req, {
      reason: 'INVALID_TOKEN',
      error: err.message,
      token: token.substring(0, 20) + '...'
    });
    
    if (err.message.includes('expired')) {      return res.status(401).send({
        message: "Token expired. Please refresh your token!",
        expired: true
      });
    }
    return res.status(401).send({
      message: "Unauthorized! Invalid token.",
    });
  }
};

verifyRefreshToken = (req, res, next) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    securityLogger.logUnauthorizedAccess(req, {
      reason: 'NO_REFRESH_TOKEN_PROVIDED'
    });
    return res.status(403).send({
      message: "Refresh token is required!"
    });
  }

  try {
    // Użyj nowego systemu JWT do weryfikacji
    const decoded = jwtManager.verifyRefreshToken(refreshToken);
    req.userId = decoded.userId;
    req.refreshTokenId = decoded.jti;
    next();
  } catch (err) {
    securityLogger.logUnauthorizedAccess(req, {
      reason: 'INVALID_REFRESH_TOKEN',
      error: err.message,
      token: refreshToken.substring(0, 20) + '...'
    });
    
    return res.status(403).send({
      message: "Invalid refresh token!"
    });
  }
};

isAdmin = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.userId);
    if (!user) {
      securityLogger.logUnauthorizedAccess(req, {
        reason: 'USER_NOT_FOUND_FOR_ADMIN_CHECK',
        userId: req.userId
      });
      return res.status(403).send({
        message: "User not found!"
      });
    }

    const roles = await user.getRoles();
    const isAdmin = roles.some(role => role.name === "admin");
    
    if (!isAdmin) {
      securityLogger.logUnauthorizedAccess(req, {
        reason: 'INSUFFICIENT_PRIVILEGES',
        requiredRole: 'admin',
        userId: req.userId,
        userRoles: roles.map(r => r.name)
      });
      
      return res.status(403).send({
        message: "Require Admin Role!"
      });
    }
    
    next();
  } catch (err) {
    console.error('Admin check error:', err);
    return res.status(500).send({
      message: "Error checking admin role!"
    });
  }
};

isModerator = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.userId);
    if (!user) {
      securityLogger.logUnauthorizedAccess(req, {
        reason: 'USER_NOT_FOUND_FOR_MODERATOR_CHECK',
        userId: req.userId
      });
      return res.status(403).send({
        message: "User not found!"
      });
    }

    const roles = await user.getRoles();
    const isModerator = roles.some(role => role.name === "moderator");
    
    if (!isModerator) {
      securityLogger.logUnauthorizedAccess(req, {
        reason: 'INSUFFICIENT_PRIVILEGES',
        requiredRole: 'moderator',
        userId: req.userId,
        userRoles: roles.map(r => r.name)
      });
      
      return res.status(403).send({
        message: "Require Moderator Role!"
      });
    }
    
    next();
  } catch (err) {
    console.error('Moderator check error:', err);
    return res.status(500).send({
      message: "Error checking moderator role!"
    });
  }
};

isModeratorOrAdmin = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.userId);
    if (!user) {
      securityLogger.logUnauthorizedAccess(req, {
        reason: 'USER_NOT_FOUND_FOR_ROLE_CHECK',
        userId: req.userId
      });
      return res.status(403).send({
        message: "User not found!"
      });
    }

    const roles = await user.getRoles();
    const hasRequiredRole = roles.some(role => 
      role.name === "moderator" || role.name === "admin"
    );
    
    if (!hasRequiredRole) {
      securityLogger.logUnauthorizedAccess(req, {
        reason: 'INSUFFICIENT_PRIVILEGES',
        requiredRole: 'moderator_or_admin',
        userId: req.userId,
        userRoles: roles.map(r => r.name)
      });
      
      return res.status(403).send({
        message: "Require Moderator or Admin Role!"
      });
    }
    
    next();  } catch (err) {
    console.error('Role check error:', err);
    return res.status(500).send({
      message: "Error checking user role!"
    });
  }
};

const authJwt = {
  verifyToken: verifyToken,
  verifyRefreshToken: verifyRefreshToken,
  isAdmin: isAdmin,
  isModerator: isModerator,
  isModeratorOrAdmin: isModeratorOrAdmin
};
module.exports = authJwt;