/**
 * Mock of the native OpeninstallModule TurboModule, aligned with the codegen
 * spec (src/specs/v1/NativeOpeninstallModule.ts) and the native
 * implementation (harmony/openinstall_react_native/.../OpeninstallTurboModule.ets):
 *
 *   config(options) / init() / clipBoardEnabled(enabled)
 *   getInstall(timeoutSeconds): Promise<Object>
 *   getWakeUp()
 *   reportRegister(): Promise<void>
 *   reportEffectPoint(effectID, effectValue, extraMap?): Promise<void>
 *   reportShare(shareCode, sharePlatform): Promise<Object>
 *
 * Usage in a test file:
 *
 *   const nativeMock = require('../__mocks__/NativeOpeninstall');
 *   TurboModuleRegistry.get.mockReturnValue(nativeMock);
 *
 * The mocked module IS the native module object, so tests can drive it with
 * `mockResolvedValueOnce` etc. directly. `jest.clearAllMocks()` clears call
 * history but keeps the built-in implementations above.
 */

'use strict';

function createNativeOpeninstallMock() {
  return {
    config: jest.fn(),
    init: jest.fn(),
    clipBoardEnabled: jest.fn(),
    getInstall: jest.fn(),
    getWakeUp: jest.fn(),
    reportRegister: jest.fn(),
    reportEffectPoint: jest.fn(),
    reportShare: jest.fn(),
  };
}

module.exports = createNativeOpeninstallMock();
