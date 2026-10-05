import type { FastifyInstance, FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

export const errorHandlerPlugin = fp(async (app: FastifyInstance) => {
  app.setErrorHandler(
    (error: FastifyError & { code?: string }, _req: FastifyRequest, reply: FastifyReply) => {
      app.log.error(error);

      if (error.code === 'P2002') {
        return reply.status(409).send({
          error: {
            code: 'UNIQUE_CONSTRAINT_VIOLATION',
            message: 'A record with this value already exists.',
            statusCode: 409,
          },
        });
      }

      if (error.code === 'P2025') {
        return reply.status(404).send({
          error: {
            code: 'RECORD_NOT_FOUND',
            message: 'The requested resource was not found.',
            statusCode: 404,
          },
        });
      }

      if (error.code === 'P2003') {
        return reply.status(400).send({
          error: {
            code: 'FOREIGN_KEY_VIOLATION',
            message: 'Invalid reference to a related resource.',
            statusCode: 400,
          },
        });
      }

      if (error.validation) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: error.message,
            statusCode: 400,
            details: error.validation,
          },
        });
      }

      let statusCode = 500;
      if (error.statusCode) {
        statusCode = error.statusCode;
      }

      let errCode = 'INTERNAL_SERVER_ERROR';
      if (error.code) {
        errCode = error.code;
      }

      let errMessage = 'An unexpected error occurred.';
      if (error.message) {
        errMessage = error.message;
      }

      return reply.status(statusCode).send({
        error: {
          code: errCode,
          message: errMessage,
          statusCode,
        },
      });
    },
  );
});
