/**
 * codegen spec(src/specs/v1/NativeOpeninstallModule.ts)契约测试。
 *
 * 按 rnoh-js-test skill 的决策树,codegen spec 属于 TurboModuleRegistry 模式,
 * 没有可测业务逻辑,只固化三个契约:
 *   1. Spec 接口存在性:default 导出即原生模块对象,方法面与鸿蒙原生
 *      OpeninstallTurboModule 一一对应
 *   2. TurboModule 注册名:'OpeninstallModule',必须与 src/index.ts 的
 *      查询名、harmony 侧 OpeninstallReactNativeTurboModulesFactory 的
 *      注册名(TM.OpeninstallModule.NAME)三方一致
 *   3. spec 不声明 Android 专有方法(getInstallCanRetry/serialEnabled/
 *      getWakeUpAlwaysCallback)——鸿蒙 SDK 无等价能力,JS 层有 android 守卫
 */

describe('NativeOpeninstallModule (codegen spec)', () => {
  it("default-exports the module resolved via getEnforcing('OpeninstallModule')", () => {
    jest.isolateModules(() => {
      const freshRN = require('react-native');
      const freshNative = require('../__mocks__/NativeOpeninstall');
      freshRN.TurboModuleRegistry.getEnforcing.mockReturnValue(freshNative);

      const spec = require('../../src/specs/v1/NativeOpeninstallModule').default;

      expect(spec).toBe(freshNative);
      expectDelegatedTo(freshRN.TurboModuleRegistry.getEnforcing, 'OpeninstallModule');
    });
  });

  it('Spec 方法面与鸿蒙原生实现一一对应', () => {
    jest.isolateModules(() => {
      const freshRN = require('react-native');
      const freshNative = require('../__mocks__/NativeOpeninstall');
      freshRN.TurboModuleRegistry.getEnforcing.mockReturnValue(freshNative);

      const spec = require('../../src/specs/v1/NativeOpeninstallModule').default;

      // 鸿蒙 @openinstall/sdk 有真实等价能力的方法面(与 mock 一致)
      ['config', 'init', 'clipBoardEnabled', 'getInstall', 'getWakeUp', 'reportRegister', 'reportEffectPoint', 'reportShare'].forEach(
        (method) => {
          expect(typeof spec[method]).toBe('function');
        }
      );
      // Android 专有方法不进 Spec
      ['getInstallCanRetry', 'serialEnabled', 'getWakeUpAlwaysCallback'].forEach(
        (method) => {
          expect(spec[method]).toBeUndefined();
        }
      );
    });
  });

  it('queries the same registration name that src/index.ts uses', () => {
    // 注册名是 JS 入口、codegen spec 与鸿蒙原生 Factory 三方的耦合点。
    // spec 与 src/index.ts 在同一隔离区内装配后,两者经
    // TurboModuleRegistry 查询过的名字集合必须恰好是 {'OpeninstallModule'}。
    jest.isolateModules(() => {
      const freshRN = require('react-native');
      const freshNative = require('../__mocks__/NativeOpeninstall');
      freshRN.TurboModuleRegistry.get.mockReturnValue(freshNative);
      freshRN.TurboModuleRegistry.getEnforcing.mockReturnValue(freshNative);

      require('../../src/specs/v1/NativeOpeninstallModule');
      require('../../src/index');

      const queriedNames = new Set([
        ...freshRN.TurboModuleRegistry.get.mock.calls.map((call) => call[0]),
        ...freshRN.TurboModuleRegistry.getEnforcing.mock.calls.map((call) => call[0]),
      ]);
      expect(queriedNames).toEqual(new Set(['OpeninstallModule']));
    });
  });
});
