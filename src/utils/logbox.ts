import { LogBox } from 'react-native';

const ignoredNetworkLogMessages = [
  'AuthRetryableFetchError: Network request failed',
  'TypeError: Network request failed',
  'Network request failed',
];

const ignoredNetworkLogPatterns = [
  /AuthRetryableFetchError:\s*Network request failed/i,
  /TypeError:\s*Network request failed/i,
  /^Network request failed$/i,
];

const globalLogState = globalThis as typeof globalThis & {
  __weneverNetworkLogFilterInstalled?: boolean;
  __weneverOriginalConsoleError?: typeof console.error;
};

function stringifyConsoleArg(arg: unknown) {
  if (arg instanceof Error) {
    return `${arg.name}: ${arg.message}`;
  }

  if (typeof arg === 'string') {
    return arg;
  }

  if (arg && typeof arg === 'object') {
    const maybeError = arg as { message?: unknown; name?: unknown };

    if (typeof maybeError.message === 'string') {
      const prefix = typeof maybeError.name === 'string' ? `${maybeError.name}: ` : '';
      return `${prefix}${maybeError.message}`;
    }
  }

  return '';
}

if (process.env.NODE_ENV !== 'production') {
  LogBox.ignoreLogs(ignoredNetworkLogMessages);

  if (!globalLogState.__weneverNetworkLogFilterInstalled) {
    const originalConsoleError = globalLogState.__weneverOriginalConsoleError ?? console.error.bind(console);
    globalLogState.__weneverOriginalConsoleError = originalConsoleError;

    console.error = (...args: Parameters<typeof console.error>) => {
      const message = args.map(stringifyConsoleArg).filter(Boolean).join(' ');

      if (ignoredNetworkLogPatterns.some((pattern) => pattern.test(message))) {
        return;
      }

      originalConsoleError(...args);
    };

    globalLogState.__weneverNetworkLogFilterInstalled = true;
  }
}
