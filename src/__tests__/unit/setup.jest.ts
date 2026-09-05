// Jest setup for CLI unit tests. Provide env defaults so config resolution is stable.
process.env.RANCHBOT_API_URL = process.env.RANCHBOT_API_URL ?? 'http://localhost:7001';
process.env.API_VERSION = process.env.API_VERSION ?? 'v1';
