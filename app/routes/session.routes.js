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
 *               - sessionCode
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: Session name
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
 *               sessionCode:
 *                 type: string
 *                 description: Session code
 *               isActive:
 *                 type: boolean
 *                 default: true
 *                 description: Flag indicating if session is active
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
 *               name:
 *                 type: string
 *                 description: Session name
 *               temperature:
 *                 type: integer
 *               rhythmType:
 *                 type: integer
 *               beatsPerMinute:
 *                 type: integer
 *               noiseLevel:
 *                 type: integer
 *               sessionCode:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *                 description: Flag indicating if session is active
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

/**
 * @swagger
 * /api/sessions/code/{code}:
 *   get:
 *     summary: Retrieve sessions by session code (for students)
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: Session Code
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: No Sessions Found with this code
 *       500:
 *         description: Server Error
 */

/**
 * @swagger
 * /api/sessions/validate-code/{code}:
 *   get:
 *     summary: Validate if a session code exists
 *     tags: [Sessions]
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: Session Code to validate
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                   description: Whether the session code exists
 *       500:
 *         description: Server Error
 */

/**
 * @swagger
 * /api/sessions/sync-all:
 *   post:
 *     summary: Synchronize all active sessions to remove ghost students
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sync completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 syncedSessions:
 *                   type: integer
 *                 ghostsRemoved:
 *                   type: integer
 *       403:
 *         description: Forbidden (requires admin or examiner role)
 *       500:
 *         description: Server error
 */

module.exports = function (app) {
  app.use(function (req, res, next) {
    res.header(
      "Access-Control-Allow-Headers",
      "x-access-token, Origin, Content-Type, Accept"
    );
    next();
  });

  app.post(
    "/api/sessions",
    [authJwt.verifyToken],
    controller.create
  );

  app.get(
    "/api/sessions",
    [authJwt.verifyToken],
    controller.findAll
  );

  app.get(
    "/api/sessions/validate/:code",
    controller.validateCode
  );

  app.get(
    "/api/sessions/code/:code",
    controller.findByCode
  );

  app.get(
    "/api/sessions/:id",
    [authJwt.verifyToken],
    controller.findOne
  );

  app.put(
    "/api/sessions/:id",
    [authJwt.verifyToken],
    controller.update
  );

  app.delete(
    "/api/sessions/:id",
    [authJwt.verifyToken],
    controller.delete
  );

  app.delete(
    "/api/sessions",
    [authJwt.verifyToken, authJwt.isAdmin],
    controller.deleteAll
  );

  app.post(
    "/api/sessions/sync-all",
    [authJwt.verifyToken],
    controller.syncAllSessions
  );
};