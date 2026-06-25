import { logger } from '../logger';

// `__DEV__` — глобал RN; jest-expo выставляет его в true. Логгер читает флаг в момент вызова,
// поэтому resetModules не нужен — достаточно тогглить `globalThis.__DEV__` и шпионить console.
interface IDevGlobal {
  __DEV__: boolean;
}

const devGlobal = globalThis as unknown as IDevGlobal;

describe('logger', () => {
  const realDev = devGlobal.__DEV__;

  afterEach(() => {
    devGlobal.__DEV__ = realDev;
    jest.restoreAllMocks();
  });

  it('в release (__DEV__=false) ничего не пишет в консоль', () => {
    devGlobal.__DEV__ = false;
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    logger.error('сбой', new Error('boom'));
    logger.warn('предупреждение');
    logger.info('инфо');
    logger.debug('отладка');

    expect(logSpy).not.toHaveBeenCalled();
  });

  it('в dev (__DEV__=true) пишет через console.log с уровнем и полным объектом ошибки', () => {
    devGlobal.__DEV__ = true;
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const error = new Error('boom');

    logger.error('сбой', error);

    expect(logSpy).toHaveBeenCalledWith('[ERROR]', 'сбой', error);
  });

  it('никогда не вызывает console.error / console.warn (нет LogBox-плашки)', () => {
    devGlobal.__DEV__ = true;
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    logger.error('сбой');
    logger.warn('предупреждение');

    expect(errorSpy).toHaveBeenCalledTimes(0);
    expect(warnSpy).toHaveBeenCalledTimes(0);
  });
});
