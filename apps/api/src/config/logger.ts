import pino from 'pino';
import { env } from './env.js';
import { NODE_ENVIRONMENTS } from '../constants/system.constants.js';

let logLevel = 'info';
if (env.NODE_ENV === NODE_ENVIRONMENTS.TEST) {
  logLevel = 'silent';
}

let transportConfig;
if (env.NODE_ENV === NODE_ENVIRONMENTS.DEVELOPMENT) {
  transportConfig = {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  };
}

export const logger = pino({
  level: logLevel,
  transport: transportConfig,
});
