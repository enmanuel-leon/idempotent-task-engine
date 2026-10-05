export const NODE_ENVIRONMENTS = {
  DEVELOPMENT: 'development',
  PRODUCTION: 'production',
  TEST: 'test',
} as const;

export type NodeEnvironment = (typeof NODE_ENVIRONMENTS)[keyof typeof NODE_ENVIRONMENTS];

export const RESPONSE_STATUS = {
  OK: 'ok',
  ERROR: 'error',
} as const;

export type ResponseStatus = (typeof RESPONSE_STATUS)[keyof typeof RESPONSE_STATUS];

export const SORT_ORDERS = {
  ASC: 'asc',
  DESC: 'desc',
} as const;

export type SortOrder = (typeof SORT_ORDERS)[keyof typeof SORT_ORDERS];
