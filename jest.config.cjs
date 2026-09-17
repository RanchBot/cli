/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  ...(!process.env.CI ? { maxWorkers: 1 } : {}),
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  verbose: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/unit/setup.jest.ts'],
  transform: {
    '^.+\\.(ts)$': [
      'ts-jest',
      {
        tsconfig: './tsconfig.json',
      },
    ],
  },
  collectCoverage: !!process.env.CI,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  collectCoverageFrom: ['src/**/*.ts', '!src/index.ts', '!src/__tests__/**/*.ts'],
};
