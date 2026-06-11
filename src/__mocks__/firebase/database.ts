import { jest } from '@jest/globals';

export const getDatabase  = jest.fn(() => ({}));
export const ref          = jest.fn(() => ({}));
export const onValue      = jest.fn(() => () => {});
export const off          = jest.fn();
export const query        = jest.fn((...args: any[]) => args[0]);
export const limitToLast  = jest.fn();
export const orderByKey   = jest.fn();
export const set          = jest.fn(() => Promise.resolve());
