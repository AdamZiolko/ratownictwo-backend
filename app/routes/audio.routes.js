const { authJwt } = require("../middleware");
const controller = require("../controllers/audio.controller");
const { uploadLimiter } = require("../middleware/security");
const { audioFileValidation } = require("../middleware/validation");
const secureFileUpload = require("../middleware/secureFileUpload");

/**
 * @swagger
 * components:
 *   schemas:
 *     Audio:
 *       type: object
 *       required:
 *         - name
 *         - length
 *         - filepath
 *         - createdBy
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique identifier for the audio file
 *         name:
 *           type: string
 *           description: Name of the audio file
 *         length:
 *           type: string
 *           description: Duration of the audio file in seconds
 *         filepath:
 *           type: string
 *           description: Server path to the audio file
 *         createdBy:
 *           type: string
 *           description: ID of the user who created the audio file
 *         updatedBy:
 *           type: string
 *           nullable: true
 *           description: ID of the user who last updated the audio file
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Timestamp when the audio file was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Timestamp when the audio file was last updated
 *     AudioUploadBase64:
 *       type: object
 *       required:
 *         - name
 *         - audioData
 *       properties:
 *         name:
 *           type: string
 *           description: Name for the audio file
 *         audioData:
 *           type: string
 *           format: byte
 *           description: Base64 encoded audio data
 *         mimeType:
 *           type: string
 *           default: audio/mp3
 *           description: MIME type of the audio file
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           description: Error message
 *     SuccessResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           description: Success message
 *         audio:
 *           $ref: '#/components/schemas/Audio'
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
   * /api/audio/list:
   *   get:
   *     summary: Get list of audio files
   *     description: Retrieve a list of all audio files uploaded by the authenticated user
   *     tags: [Audio]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: List of audio files retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Audio'
   *       401:
   *         description: Unauthorized - Invalid or missing token
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  app.get(
    "/api/audio/list",
    [authJwt.verifyToken],
    controller.getAudioList
  );
  /**
   * @swagger
   * /api/audio/{id}/stream:
   *   get:
   *     summary: Stream audio file
   *     description: Stream an audio file with support for range requests (partial content)
   *     tags: [Audio]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: The audio file ID
   *       - in: header
   *         name: range
   *         required: false
   *         schema:
   *           type: string
   *         description: HTTP Range header for partial content requests
   *         example: bytes=0-1023
   *     responses:
   *       200:
   *         description: Full audio file stream
   *         content:
   *           audio/mpeg:
   *             schema:
   *               type: string
   *               format: binary
   *         headers:
   *           Content-Length:
   *             description: Size of the audio file in bytes
   *             schema:
   *               type: integer
   *           Content-Type:
   *             description: MIME type of the audio file
   *             schema:
   *               type: string
   *               example: audio/mpeg
   *       206:
   *         description: Partial content (range request)
   *         content:
   *           audio/mpeg:
   *             schema:
   *               type: string
   *               format: binary
   *         headers:
   *           Content-Range:
   *             description: Range of bytes being served
   *             schema:
   *               type: string
   *               example: bytes 0-1023/2048
   *           Accept-Ranges:
   *             description: Indicates server accepts range requests
   *             schema:
   *               type: string
   *               example: bytes
   *           Content-Length:
   *             description: Size of the partial content in bytes
   *             schema:
   *               type: integer
   *       401:
   *         description: Unauthorized - Invalid or missing token
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       404:
   *         description: Audio file not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  app.get(
    "/api/audio/:id/stream",
    controller.streamAudio
  );

  /**
   * @swagger
   * /api/audio/{id}/download:
   *   get:
   *     summary: Download audio file
   *     description: Download an audio file as an attachment
   *     tags: [Audio]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: The audio file ID
   *     responses:
   *       200:
   *         description: Audio file downloaded successfully
   *         content:
   *           audio/mpeg:
   *             schema:
   *               type: string
   *               format: binary
   *         headers:
   *           Content-Disposition:
   *             description: Attachment header with filename
   *             schema:
   *               type: string
   *               example: attachment; filename="audio.mp3"
   *       401:
   *         description: Unauthorized - Invalid or missing token
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       404:
   *         description: Audio file not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  app.get(
    "/api/audio/:id/download",
    controller.downloadAudio
  );
  /**
   * @swagger
   * /api/audio/{id}/delete:
   *   delete:
   *     summary: Delete audio file
   *     description: Delete an audio file. Only the owner can delete their own files.
   *     tags: [Audio]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: The audio file ID to delete
   *     responses:
   *       200:
   *         description: Audio file deleted successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Plik audio został pomyślnie usunięty."
   *       401:
   *         description: Unauthorized - Invalid or missing token
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       403:
   *         description: Forbidden - User doesn't own this audio file
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       404:
   *         description: Audio file not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  app.delete(
    "/api/audio/:id/delete",
    [authJwt.verifyToken],
    controller.deleteAudio
  );


  /**
   * @swagger
   * /api/audio/upload:
   *   post:
   *     summary: Upload new audio file (Base64)
   *     description: Upload a new audio file using Base64 encoded data
   *     tags: [Audio]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/AudioUploadBase64'
   *           examples:
   *             mp3Upload:
   *               summary: Upload MP3 file
   *               value:
   *                 name: "My Audio File"
   *                 audioData: "UklGRi4EAABXQVZFZm10IBAAAAABAAEA..."
   *                 mimeType: "audio/mp3"
   *             wavUpload:
   *               summary: Upload WAV file
   *               value:
   *                 name: "Recording"
   *                 audioData: "UklGRi4EAABXQVZFZm10IBAAAAABAAEA..."
   *                 mimeType: "audio/wav"
   *     responses:
   *       201:
   *         description: Audio file uploaded successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SuccessResponse'
   *       400:
   *         description: Bad request - Missing required fields
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *             examples:
   *               missingAudioData:
   *                 summary: Missing audio data
   *                 value:
   *                   message: "Brak danych audio."
   *               missingName:
   *                 summary: Missing name
   *                 value:
   *                   message: "Proszę podać nazwę pliku audio."
   *       401:
   *         description: Unauthorized - Invalid or missing token
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       404:
   *         description: User not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */  app.post(
    "/api/audio/upload",
    [authJwt.verifyToken, uploadLimiter],
    controller.uploadAudioBase64
  );

  /**
   * @swagger
   * /api/audio/upload-form:
   *   post:
   *     summary: Upload new audio file (FormData - Legacy)
   *     description: Upload a new audio file using multipart form data. This is a legacy endpoint, consider using the Base64 upload endpoint instead.
   *     tags: [Audio]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             required:
   *               - name
   *               - audio
   *             properties:
   *               name:
   *                 type: string
   *                 description: Name for the audio file
   *               audio:
   *                 type: string
   *                 format: binary
   *                 description: Audio file to upload (max 100MB)
   *           examples:
   *             audioUpload:
   *               summary: Upload audio file
   *               value:
   *                 name: "My Audio Recording"
   *                 audio: "(binary audio file)"
   *     responses:
   *       201:
   *         description: Audio file uploaded successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SuccessResponse'
   *       400:
   *         description: Bad request - Missing required fields or invalid file
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *             examples:
   *               missingFile:
   *                 summary: Missing audio file
   *                 value:
   *                   message: "Proszę przesłać plik audio."
   *               missingName:
   *                 summary: Missing name
   *                 value:
   *                   message: "Proszę podać nazwę pliku audio."
   *               invalidFileType:
   *                 summary: Invalid file type
   *                 value:
   *                   message: "Tylko pliki audio są dozwolone!"
   *       401:
   *         description: Unauthorized - Invalid or missing token
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       404:
   *         description: User not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       413:
   *         description: File too large (max 100MB)
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */  app.post(
    "/api/audio/upload-form",
    [authJwt.verifyToken, uploadLimiter, secureFileUpload.processUpload, audioFileValidation],
    controller.uploadAudio
  );
};