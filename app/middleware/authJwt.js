const jwt = require("jsonwebtoken");
const config = require("../config/auth.config.js");
const db = require("../models");
const User = db.user;
const RefreshToken = db.refreshToken;

verifyToken = (req, res, next) => {
  let token = req.headers["x-access-token"];

  const authHeader = req.headers["authorization"];
  if (!token && authHeader) {
    const bearerToken = authHeader.split(' ')[1];
    if (bearerToken) {
      token = bearerToken;
    }
  }

  if (!token) {
    return res.status(403).send({
      message: "No token provided!"
    });
  }

  jwt.verify(token,
            config.secret,
            (err, decoded) => {
              if (err) {
                if (err instanceof jwt.TokenExpiredError) {
                  return res.status(401).send({
                    message: "Token expired. Please refresh your token!",
                    expired: true
                  });
                }
                
                return res.status(401).send({
                  message: "Unauthorized!",
                });
              }
              req.userId = decoded.id;
              next();
            });
};

verifyRefreshToken = (req, res, next) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    return res.status(403).send({
      message: "Refresh token is required!"
    });
  }

  RefreshToken.findOne({ where: { token: refreshToken } })
    .then(token => {
      if (!token) {
        return res.status(403).send({
          message: "Refresh token is not valid!"
        });
      }

      if (token.expiryDate.getTime() < new Date().getTime()) {
        RefreshToken.destroy({ where: { token: refreshToken } });
        
        return res.status(403).send({
          message: "Refresh token was expired. Please sign in again!"
        });
      }

      jwt.verify(refreshToken, config.refreshTokenSecret, (err, decoded) => {
        if (err) {
          return res.status(403).send({
            message: "Invalid refresh token!"
          });
        }
        
        req.userId = decoded.id;
        next();
      });
    })
    .catch(err => {
      res.status(500).send({
        message: "Error verifying refresh token!"
      });
    });
};

isAdmin = (req, res, next) => {
  User.findByPk(req.userId).then(user => {
    user.getRoles().then(roles => {
      for (let i = 0; i < roles.length; i++) {
        if (roles[i].name === "admin") {
          next();
          return;
        }
      }

      res.status(403).send({
        message: "Require Admin Role!"
      });
      return;
    });
  });
};

isModerator = (req, res, next) => {
  User.findByPk(req.userId).then(user => {
    user.getRoles().then(roles => {
      for (let i = 0; i < roles.length; i++) {
        if (roles[i].name === "moderator") {
          next();
          return;
        }
      }

      res.status(403).send({
        message: "Require Moderator Role!"
      });
    });
  });
};

isModeratorOrAdmin = (req, res, next) => {
  User.findByPk(req.userId).then(user => {
    user.getRoles().then(roles => {
      for (let i = 0; i < roles.length; i++) {
        if (roles[i].name === "moderator") {
          next();
          return;
        }

        if (roles[i].name === "admin") {
          next();
          return;
        }
      }

      res.status(403).send({
        message: "Require Moderator or Admin Role!"
      });
    });
  });
};

const authJwt = {
  verifyToken: verifyToken,
  verifyRefreshToken: verifyRefreshToken,
  isAdmin: isAdmin,
  isModerator: isModerator,
  isModeratorOrAdmin: isModeratorOrAdmin
};
module.exports = authJwt;