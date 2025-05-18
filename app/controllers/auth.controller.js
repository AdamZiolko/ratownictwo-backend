const db = require("../models");
const config = require("../config/auth.config");
const User = db.user;
const RefreshToken = db.refreshToken;

var jwt = require("jsonwebtoken");
var bcrypt = require("bcryptjs");

const createRefreshToken = async (userId) => {
  const expiredAt = new Date();
  expiredAt.setSeconds(expiredAt.getSeconds() + config.jwtRefreshExpiration);

  const _token = jwt.sign({ id: userId }, config.refreshTokenSecret, {
    expiresIn: config.jwtRefreshExpiration,
  });

  const existingToken = await RefreshToken.findOne({ where: { userId: userId } });
  
  if (existingToken) {
    existingToken.token = _token;
    existingToken.expiryDate = expiredAt;
    await existingToken.save();
    return existingToken.token;
  } else {
    const refreshToken = await RefreshToken.create({
      token: _token,
      userId: userId,
      expiryDate: expiredAt,
    });
    return refreshToken.token;
  }
};

exports.signup = (req, res) => {
  User.create({
    username: req.body.username,
    email: req.body.email,
    password: bcrypt.hashSync(req.body.password, 8)
  })
    .then(user => {
      user.setRoles([1]).then(() => {
        res.send({ message: "User registered successfully!" });
      });
    })
    .catch(err => {
      res.status(500).send({ message: err.message });
    });
};

exports.signin = async (req, res) => {
  try {
    const loginIdentifier = req.body.username || req.body.email;
    
    if (!loginIdentifier) {
      return res.status(400).send({ message: "Username or email is required for login." });
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
      return res.status(404).send({ message: "User Not found." });
    }

    var passwordIsValid = bcrypt.compareSync(
      req.body.password,
      user.password
    );

    if (!passwordIsValid) {
      return res.status(401).send({
        accessToken: null,
        message: "Invalid Password!"
      });
    }

    const token = jwt.sign({ id: user.id },
      config.secret,
      {
        algorithm: 'HS256',
        allowInsecureKeySizes: true,
        expiresIn: config.jwtExpiration, 
      });

    const refreshToken = await createRefreshToken(user.id);

    const roles = await user.getRoles();
    var authorities = [];
    for (let i = 0; i < roles.length; i++) {
      authorities.push("ROLE_" + roles[i].name.toUpperCase());
    }

    res.status(200).send({
      id: user.id,
      username: user.username,
      email: user.email,
      roles: authorities,
      accessToken: token,
      refreshToken: refreshToken
    });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.refreshToken = async (req, res) => {
  const { refreshToken: requestToken } = req.body;

  if (!requestToken) {
    return res.status(403).json({ message: "Refresh Token is required!" });
  }

  try {
    const refreshToken = await RefreshToken.findOne({ where: { token: requestToken } });

    if (!refreshToken) {
      return res.status(403).json({ message: "Refresh token not found!" });
    }

    if (refreshToken.expiryDate.getTime() < new Date().getTime()) {
      await RefreshToken.destroy({ where: { token: requestToken } });
      return res.status(403).json({
        message: "Refresh token was expired. Please sign in again!",
      });
    }

    let userId;
    try {
      const decoded = jwt.verify(requestToken, config.refreshTokenSecret);
      userId = decoded.id;
    } catch (err) {
      return res.status(403).json({ message: "Invalid refresh token!" });
    }

    const newAccessToken = jwt.sign({ id: userId }, config.secret, {
      expiresIn: config.jwtExpiration,
    });

    return res.status(200).json({
      accessToken: newAccessToken,
      refreshToken: requestToken
    });
  } catch (err) {
    return res.status(500).send({ message: err.message });
  }
};