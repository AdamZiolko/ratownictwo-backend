const { verifySignUp } = require("../middleware");
const controller = require("../controllers/auth.controller");
const { loginLimiter, registrationLimiter, authLimiter } = require("../middleware/security");
const accountLockout = require("../middleware/accountLockout");
const passwordValidation = require("../middleware/passwordValidation");
const { 
  registrationValidation, 
  loginValidation, 
  handleValidationErrors 
} = require("../middleware/validation");

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication endpoints
 */

/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /api/auth/signin:
 *   post:
 *     summary: Login to the application
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 description: Username or email can be used for login
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email or username can be used for login
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 username:
 *                   type: string
 *                 email:
 *                   type: string
 *                 roles:
 *                   type: array
 *                   items:
 *                     type: string
 *                 accessToken:
 *                   type: string
 *       401:
 *         description: Invalid Password
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /api/auth/refreshtoken:
 *   post:
 *     summary: Refresh access token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *       403:
 *         description: Refresh token is invalid or expired
 *       500:
 *         description: Server error
 */

module.exports = function(app) {
  app.use(function(req, res, next) {
    res.header(
      "Access-Control-Allow-Headers",
      "x-access-token, Origin, Content-Type, Accept"
    );
    next();
  });

  app.post(
    "/api/auth/signup",
    [
      registrationLimiter,
      ...registrationValidation,
      handleValidationErrors,
      passwordValidation.middleware(),
      verifySignUp.checkDuplicateUsernameOrEmail,
      verifySignUp.checkRolesExisted
    ],
    controller.signup
  );

  app.post(
    "/api/auth/signin", 
    [
      loginLimiter,
      accountLockout.middleware(),
      ...loginValidation,
      handleValidationErrors
    ],
    controller.signin
  );
  
  // Add refresh token endpoint
  app.post("/api/auth/refreshtoken", loginLimiter, controller.refreshToken);
};
