const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Ratownictwo API',
      version: '1.0.0',
      description: 'API documentation for Ratownictwo application with JWT Authentication and PostgreSQL',
      contact: {
        name: 'API Support',
        email: 'support@example.com'
      },
    },    servers: [
      {
        url: 'http://192.168.100.6:8080',
        description: 'Development server',
      },
    ],
    tags: [
      {
        name: 'Auth',
        description: 'Authentication endpoints'
      },
      {
        name: 'User',
        description: 'User management endpoints'
      },
      {
        name: 'Session',
        description: 'Session management endpoints'
      },
      {
        name: 'Preset',
        description: 'Preset configuration endpoints'
      },      {
        name: 'Audio',
        description: 'Audio file management endpoints - Upload, download, stream, and manage audio files'
      },
      {
        name: 'Color Configuration',
        description: 'Color configuration endpoints for sessions'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token obtained from /api/auth/signin endpoint'
        },
      },
    },
    security: [{
      bearerAuth: [],
    }],
  },
  apis: [
    './app/routes/*.js',
    './app/models/*.js',
  ],
};

const specs = swaggerJsdoc(options);

module.exports = specs;