import swaggerJsDoc from 'swagger-jsdoc';

const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'IPTRADE API Documentation',
      version: '1.0.0',
      description: 'API for managing master and slave accounts',
    },
    servers: [
      {
        url: 'http://localhost:30/api',
      },
    ],
  },
  apis: ['./server/src/routes/*.js'], // Correct path for route files
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);

export default swaggerDocs;
