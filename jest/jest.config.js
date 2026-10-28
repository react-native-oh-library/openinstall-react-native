/**
 * Notes:
 * - This config lives in jest/; `rootDir` points back to the project root so
 *   testMatch and collectCoverageFrom still measure the production sources.
 * - Run via `npm test` / `npm run test:coverage`, which pass --config explicitly.
 * - The transforms use an inline babelConfig so any repo-level babel config
 *   would be ignored.
 * - `.js` test files go through preset-env; `src/index.ts` and the codegen
 *   spec are TypeScript, stripped by preset-typescript.
 * - `react-native` is mapped to a lightweight manual mock so tests run on a
 *   plain Node environment without a device or the RN runtime.
 */

module.exports = {
  testEnvironment: 'node',
  rootDir: './..',
  transform: {
    '^.+\\.jsx?$': [
      'babel-jest',
      {
        babelrc: false,
        configFile: false,
        presets: [
          ['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }],
        ],
      },
    ],
    '^.+\\.tsx?$': [
      'babel-jest',
      {
        babelrc: false,
        configFile: false,
        presets: [
          ['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }],
          ['@babel/preset-typescript', { allowDeclareFields: true }],
        ],
      },
    ],
  },
  moduleNameMapper: {
    '^react-native$': '<rootDir>/jest/__mocks__/react-native.js',
  },
  testMatch: ['<rootDir>/jest/__tests__/**/*-test.js'],
  testPathIgnorePatterns: ['/node_modules/', '/example/', '/dist/'],
  setupFiles: ['<rootDir>/jest/jest.setup.js'],
  // The default 'babel' provider fails to attribute istanbul data to the
  // TypeScript sources; the 'v8' provider reads execution data straight from
  // the engine and reports it correctly.
  coverageProvider: 'v8',
  collectCoverageFrom: [
    'src/index.ts',
    'src/specs/v1/NativeOpeninstallModule.ts',
    '!**/__tests__/**',
    '!**/__mocks__/**',
  ],
  coverageThreshold: {
    global: { branches: 60 },
  },
};
