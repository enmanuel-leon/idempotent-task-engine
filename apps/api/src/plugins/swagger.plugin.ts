import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import fp from 'fastify-plugin';
import { APP_NAME } from '../config/constants.js';

export const swaggerPlugin = fp(async (fastify) => {
  await fastify.register(fastifySwagger, {
    openapi: {
      info: {
        title: APP_NAME,
        description: 'API Documentation',
        version: '1.0.0',
      },
    },
  });

  await fastify.register(fastifySwaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
  });
});
