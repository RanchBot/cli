import native = require('fs-native-extensions');

// Observe real native contention without changing acquisition or retries.
const tryLock = native.tryLock;
let reportedContention = false;
native.tryLock = (fd: number) => {
  const acquired = tryLock(fd);
  if (!acquired && !reportedContention) {
    reportedContention = true;
    process.send?.('contended');
  }
  return acquired;
};

import loginCommand = require('../../commands/login');
import logoutCommand = require('../../commands/logout');
import session = require('../../session');

const run = async () => {
  const overrides = { apiUrl: process.argv[3], clientId: 'ranchbot-cli' };
  switch (process.argv[2]) {
    case 'login':
      await loginCommand.login(overrides);
      break;
    case 'logout':
      await logoutCommand.logout(overrides);
      break;
    case 'refresh':
      await session.getAuthenticatedClient(overrides);
      break;
    case 'use':
      await (await session.getAuthenticatedClient(overrides)).client.getFarms();
      break;
    default:
      throw new Error('Unknown worker operation');
  }
};

run().then(
  () => process.disconnect?.(),
  (error: Error) => {
    process.stderr.write(error.message);
    process.exitCode = 1;
    process.disconnect?.();
  },
);
