const { authJwt } = require("../middleware");
const controller = require("../controllers/session.controller");

/**
 * @swagger
 * tags:
 *   name: Sessions
 *   description: Session management endpoints
 */

/**
 * @swagger
 * /api/sessions:
 *   post:
 *     summary: Create a new session
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - temperature
 *               - rhythmType
 *               - beatsPerMinute
 *               - noiseLevel
 *               - session_code
 *             properties:
 *               temperature:
 *                 type: integer
 *                 description: Temperature value
 *               rhythmType:
 *                 type: integer
 *                 description: Rhythm type (tinyint)
 *               beatsPerMinute:
 *                 type: integer
 *                 description: Beats per minute
 *               noiseLevel:
 *                 type: integer
 *                 description: Noise level
 *               session_code:
 *                 type: integer
 *                 description: Session code
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Bad Request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server Error
 *
 *   get:
 *     summary: Retrieve all sessions
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server Error
 */

/**
 * @swagger
 * /api/sessions/{id}:
 *   get:
 *     summary: Retrieve a single session by ID
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Session ID
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Session Not Found
 *       500:
 *         description: Server Error
 *
 *   put:
 *     summary: Update a session by ID
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Session ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               temperature:
 *                 type: integer
 *               rhythmType:
 *                 type: integer
 *               beatsPerMinute:
 *                 type: integer
 *               noiseLevel:
 *                 type: integer
 *               session_code:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Session Not Found
 *       500:
 *         description: Server Error
 *
 *   delete:
 *     summary: Delete a session by ID
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Session ID
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Session Not Found
 *       500:
 *         description: Server Error
 */

module.exports = function(app) {
  app.use(function(req, res, next) {
    res.header(
      "Access-Control-Allow-Headers",
      "x-access-token, Origin, Content-Type, Accept"
    );
    next();
  });

  // Create a new Session
  app.post(
    "/api/sessions",
    [authJwt.verifyToken],
    controller.create
  );

  // Retrieve all Sessions
  app.get(
    "/api/sessions",
    [authJwt.verifyToken],
    controller.findAll
  );

  // Retrieve a single Session with id
  app.get(
    "/api/sessions/:id",
    [authJwt.verifyToken],
    controller.findOne
  );

  // Update a Session with id
  app.put(
    "/api/sessions/:id",
    [authJwt.verifyToken],
    controller.update
  );

  // Delete a Session with id
  app.delete(
    "/api/sessions/:id",
    [authJwt.verifyToken],
    controller.delete
  );

  // Delete all Sessions
  app.delete(
    "/api/sessions",
    [authJwt.verifyToken, authJwt.isAdmin],
    controller.deleteAll
  );
};