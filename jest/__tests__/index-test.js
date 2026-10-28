/**
 * src/index.ts 模块装配与平台分支逻辑测试。
 *
 * 整个库的 JS 层装配逻辑只有一条:
 *
 *   const OS: string = Platform.OS;
 *   const Native = OS === 'harmony'
 *     ? TurboModuleRegistry.get('OpeninstallModule')
 *     : NativeModules.OpeninstallModule;
 *
 * 用例覆盖全部分支:
 *   1. 装配:harmony 走 TurboModuleRegistry.get('OpeninstallModule');
 *      android/ios 走旧架构 NativeModules.OpeninstallModule;
 *      原生模块缺失时类仍可加载、方法安全 no-op。
 *   2. 平台分支语义:android 专有接口(config/getInstallCanRetry/
 *      getWakeUpAlwaysCallback/serialEnabled)与 iOS 分支(configIOS/init
 *      → initSDK)在对应平台的委托行为。
 *
 * 注意:src/index.ts 在模块加载期完成平台判断与原生解析,每个场景都要在
 * jest.isolateModules 隔离区内重新装配;隔离区内 react-native mock 会被
 * 重新实例化,必须在新实例上设置 Platform.OS 与解析结果后再 require。
 */

/** 在隔离区内以指定平台装配 src/index,返回 { openinstall, freshRN, nativeMock }。 */
function assembleWith(platform, nativeMock) {
  let openinstall;
  let freshRN;
  jest.isolateModules(() => {
    freshRN = require('react-native');
    freshRN.Platform.OS = platform;
    if (platform === 'harmony') {
      freshRN.TurboModuleRegistry.get.mockReturnValue(nativeMock);
    } else {
      freshRN.NativeModules.OpeninstallModule = nativeMock;
    }
    openinstall = require('../../src/index').default;
  });
  return { openinstall, freshRN, nativeMock };
}

function freshNative() {
  let native;
  jest.isolateModules(() => {
    native = require('../__mocks__/NativeOpeninstall');
  });
  return native;
}

/**
 * 旧架构(android/ios)方法面:在 Spec mock 上叠加 LegacyOpeninstallModule
 * 的可选成员。Spec mock 本身不含这些方法,以固化"Android 专有 API 不进
 * codegen spec"的契约(见 NativeOpeninstallModule-test.js)。
 */
function legacyNative() {
  return Object.assign(freshNative(), {
    initSDK: jest.fn(),
    serialEnabled: jest.fn(),
    getInstallCanRetry: jest.fn(),
    getWakeUpAlwaysCallback: jest.fn(),
  });
}

describe('index 装配逻辑', () => {
  it("harmony 上经 TurboModuleRegistry.get('OpeninstallModule') 解析原生模块", () => {
    jest.isolateModules(() => {
      const freshRN = require('react-native');
      const freshNative = require('../__mocks__/NativeOpeninstall');
      freshRN.Platform.OS = 'harmony';
      freshRN.TurboModuleRegistry.get.mockReturnValue(freshNative);

      const openinstall = require('../../src/index').default;

      // 类即门面:静态方法委托到解析出的原生模块
      openinstall.clipBoardEnabled(true);
      expectDelegatedTo(freshNative.clipBoardEnabled, true);
      expectDelegatedTo(freshRN.TurboModuleRegistry.get, 'OpeninstallModule');
    });
  });

  it('android 上沿用旧架构 NativeModules.OpeninstallModule 入口', () => {
    jest.isolateModules(() => {
      const freshRN = require('react-native');
      const legacyMock = require('../__mocks__/NativeOpeninstall');
      freshRN.Platform.OS = 'android';
      freshRN.NativeModules.OpeninstallModule = legacyMock;

      const openinstall = require('../../src/index').default;

      // config 三参打包是 android 分支的真实委托路径
      openinstall.config(true, 'oaid-x');
      expectDelegatedTo(legacyMock.config, { adEnabled: true, oaid: 'oaid-x', gaid: undefined });
      // 旧架构平台不得触碰 TurboModuleRegistry
      expect(freshRN.TurboModuleRegistry.get).not.toHaveBeenCalled();
    });
  });

  it('ios 上沿用旧架构 NativeModules.OpeninstallModule 入口', () => {
    jest.isolateModules(() => {
      const freshRN = require('react-native');
      const legacyMock = require('../__mocks__/NativeOpeninstall');
      freshRN.Platform.OS = 'ios';
      freshRN.NativeModules.OpeninstallModule = legacyMock;

      const openinstall = require('../../src/index').default;

      // configIOS 是 ios 分支的真实委托路径
      openinstall.configIOS({ ASAEnabled: true });
      expectDelegatedTo(legacyMock.config, { ASAEnabled: true });
      expect(freshRN.TurboModuleRegistry.get).not.toHaveBeenCalled();
    });
  });

  it('原生模块缺失时类仍可加载,方法调用安全 no-op', async () => {
    let openinstall;
    jest.isolateModules(() => {
      const freshRN = require('react-native');
      freshRN.Platform.OS = 'harmony';
      // TurboModuleRegistry.get 默认返回 undefined,模拟原生未注册

      openinstall = require('../../src/index').default;
    });

    expect(() => {
      openinstall.configAndroid({ adEnabled: true });
      openinstall.init();
      openinstall.clipBoardEnabled(false);
    }).not.toThrow();
    // Promise 型接口兜底 resolve,不产生未捕获拒绝
    await expect(openinstall.reportRegister()).resolves.toBeUndefined();
    await expect(openinstall.reportEffectPoint('id', 1)).resolves.toBeUndefined();
  });
});

describe('android 平台分支语义', () => {
  it('config(adEnabled, oaid, gaid) 打包成单个 options 委托原生', () => {
    const native = legacyNative();
    const { openinstall } = assembleWith('android', native);

    openinstall.config(true, 'oaid-x', 'gaid-y');

    expectDelegatedTo(native.config, { adEnabled: true, oaid: 'oaid-x', gaid: 'gaid-y' });
  });

  it('init 忽略 options,直接调用原生 init()', () => {
    const native = legacyNative();
    const { openinstall } = assembleWith('android', native);

    openinstall.init({ adEnabled: true });

    expect(native.init).toHaveBeenCalledTimes(1);
    expect(native.config).not.toHaveBeenCalled();
  });

  it('getInstall 走旧架构双参签名,结果原样透传回调', () => {
    const native = legacyNative();
    const { openinstall } = assembleWith('android', native);
    const payload = { channel: 'oppo', data: '{"k":1}', shouldRetry: false };
    native.getInstall.mockImplementationOnce((_s, cb) => cb(payload));

    let received;
    openinstall.getInstall(10, (result) => {
      received = result;
    });

    expect(received).toBe(payload);
    expectDelegatedTo(native.getInstall, 10, expect.any(Function));
  });

  it('getInstallCanRetry 委托原生双参签名', () => {
    const native = legacyNative();
    const { openinstall } = assembleWith('android', native);
    const payload = { channel: null, data: 'd', shouldRetry: true };
    native.getInstallCanRetry.mockImplementationOnce((_s, cb) => cb(payload));

    let received;
    openinstall.getInstallCanRetry(15, (result) => {
      received = result;
    });

    expect(received).toBe(payload);
    expectDelegatedTo(native.getInstallCanRetry, 15, expect.any(Function));
  });

  it('getWakeUpAlwaysCallback:原生回调 + 事件通道双路触发', () => {
    const native = legacyNative();
    const { openinstall, freshRN } = assembleWith('android', native);
    native.getWakeUpAlwaysCallback.mockImplementationOnce((cb) =>
      cb({ channel: 'huawei', data: null })
    );
    const received = [];

    openinstall.getWakeUpAlwaysCallback((result) => received.push(result));

    // 原生立即回调一路
    expect(received).toEqual([{ channel: 'huawei', data: null }]);
    // 事件通道注册一路:'OpeninstallWakeupCallBack' 事件下发同样触发回调
    expect(freshRN.DeviceEventEmitter.addListener).toHaveBeenCalledWith(
      'OpeninstallWakeupCallBack',
      expect.any(Function)
    );
    const handler = freshRN.DeviceEventEmitter.addListener.mock.calls[0][1];
    handler({ channel: null, data: 'from-event' });
    expect(received).toEqual([
      { channel: 'huawei', data: null },
      { channel: null, data: 'from-event' },
    ]);
  });

  it('reportEffectPoint 即发即弃,不接收 Promise 也 resolve', async () => {
    const native = legacyNative();
    const { openinstall } = assembleWith('android', native);

    await expect(openinstall.reportEffectPoint('point-1', 9900, { sku: 'A' })).resolves.toBeUndefined();

    expectDelegatedTo(native.reportEffectPoint, 'point-1', 9900, { sku: 'A' });
  });
});

describe('ios 平台分支语义', () => {
  it('configIOS 委托原生 config', () => {
    const native = legacyNative();
    const { openinstall } = assembleWith('ios', native);

    openinstall.configIOS({ ASAEnabled: true, idfaStr: 'idfa' });

    expectDelegatedTo(native.config, { ASAEnabled: true, idfaStr: 'idfa' });
  });

  it('init 透传 options 调用原生 initSDK', () => {
    const native = legacyNative();
    const { openinstall } = assembleWith('ios', native);

    openinstall.init({ ASAEnabled: false });

    expectDelegatedTo(native.initSDK, { ASAEnabled: false });
    expect(native.init).not.toHaveBeenCalled();
  });
});
