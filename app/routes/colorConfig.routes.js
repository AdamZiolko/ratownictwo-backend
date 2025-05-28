const controller = require("../controllers/colorConfig.controller");
const { verifyToken } = require("../middleware/authJwt");

/**
 * @swagger
 * components:
 *   schemas:
 *     ColorConfig:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: Unique identifier for the color configuration
 *         sessionId:
 *           type: string
 *           description: Session ID this configuration belongs to
 *         color:
 *           type: string
 *           enum: [red, green, blue, yellow, orange, purple]
 *           description: Color to configure
 *         soundName:
 *           type: string
 *           description: Local sound file name (if null, use server audio)
 *         serverAudioId:
 *           type: string
 *           description: Server audio file ID (if null, use local sound)
 *         isEnabled:
 *           type: boolean
 *           description: Whether this color configuration is enabled
 *         volume:
 *           type: number
 *           minimum: 0
 *           maximum: 1
 *           description: Volume level for this color
 *         isLooping:
 *           type: boolean
 *           description: Whether the sound should loop
 *     ColorConfigRequest:
 *       type: object
 *       required:
 *         - color
 *       properties:
 *         color:
 *           type: string
 *           enum: [red, green, blue, yellow, orange, purple]
 *         soundName:
 *           type: string
 *         serverAudioId:
 *           type: string
 *         isEnabled:
 *           type: boolean
 *         volume:
 *           type: number
 *           minimum: 0
 *           maximum: 1
 *         isLooping:
 *           type: boolean
 */

module.exports = function(app) {
  app.use(function(req, res, next) {
    res.header(
      "Access-Control-Allow-Headers",
      "x-access-token, Origin, Content-Type, Accept"
    );
    next();
  });

  /**
   * @swagger
   * /api/color-config/{sessionId}:
   *   get:
   *     summary: Get color configurations for a session
   *     description: Retrieve all color sound configurations for a specific session
   *     tags: [ColorConfig]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: sessionId
   *         required: true
   *         schema:
   *           type: string
   *         description: The session ID
   *     responses:
   *       200:
   *         description: Color configurations retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 colorConfigs:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/ColorConfig'
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Session not found
   *       500:
   *         description: Internal server error
   */  app.get("/api/color-config/:sessionId", [verifyToken], controller.getColorConfigs);

  /**
   * @swagger
   * /api/color-config/student/{sessionId}:
   *   get:
   *     summary: Get color configurations for students (no authentication required)
   *     description: Retrieve all color configurations for a session - accessible by students without authentication
   *     tags: [Color Configuration]
   *     parameters:
   *       - in: path
   *         name: sessionId
   *         required: true
   *         schema:
   *           type: string
   *         description: Session ID
   *     responses:
   *       200:
   *         description: Color configurations retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 colorConfigs:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/ColorConfig'
   *       404:
   *         description: Session not found
   *       500:
   *         description: Internal server error
   */
  app.get("/api/color-config/student/:sessionId", controller.getColorConfigsForStudent);

  /**
   * @swagger
   * /api/color-config/{sessionId}:
   *   post:
   *     summary: Create or update color configuration
   *     description: Create or update a color sound configuration for a session
   *     tags: [ColorConfig]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: sessionId
   *         required: true
   *         schema:
   *           type: string
   *         description: The session ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/ColorConfigRequest'
   *     responses:
   *       200:
   *         description: Color configuration updated successfully
   *       201:
   *         description: Color configuration created successfully
   *       400:
   *         description: Bad request
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Session not found
   *       500:
   *         description: Internal server error   */
  app.post("/api/color-config/:sessionId", [verifyToken], controller.saveColorConfig);

  /**
   * @swagger
   * /api/color-config/{sessionId}/{color}:
   *   delete:
   *     summary: Delete color configuration
   *     description: Delete a specific color configuration for a session
   *     tags: [ColorConfig]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: sessionId
   *         required: true
   *         schema:
   *           type: string
   *         description: The session ID
   *       - in: path
   *         name: color
   *         required: true
   *         schema:
   *           type: string
   *           enum: [red, green, blue, yellow, orange, purple]
   *         description: The color to delete
   *     responses:
   *       200:
   *         description: Color configuration deleted successfully
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Session or color configuration not found
   *       500:
   *         description: Internal server error   */
  app.delete("/api/color-config/:sessionId/:color", [verifyToken], controller.deleteColorConfig);

  /**
   * @swagger
   * /api/color-config/{sessionId}/bulk:
   *   post:
   *     summary: Bulk update color configurations
   *     description: Update multiple color configurations at once
   *     tags: [ColorConfig]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: sessionId
   *         required: true
   *         schema:
   *           type: string
   *         description: The session ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               colorConfigs:
   *                 type: array
   *                 items:
   *                   $ref: '#/components/schemas/ColorConfigRequest'
   *     responses:
   *       200:
   *         description: Color configurations updated successfully
   *       400:
   *         description: Bad request
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Session not found
   *       500:
   *         description: Internal server error   */
  app.post("/api/color-config/:sessionId/bulk", [verifyToken], controller.bulkUpdateColorConfigs);

  // Add toggle endpoint
  app.put("/api/color-config/:sessionId/:color/toggle", [verifyToken], controller.toggleColorConfig);
};
