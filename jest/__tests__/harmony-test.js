/**
 * 鸿蒙(HarmonyOS/RNOH)适配契约测试。
 *
 * 与 index-test.js 不同,本文件在模块加载前一次性把原生模块 mock 设置到
 * TurboModuleRegistry 上,再让 src/index.ts 真实走一遍装配链路 —— 与鸿蒙
 * 设备上的装配一致:
 *
 *   JS 层 → src/index.ts → TurboModuleRegistry.get('OpeninstallModule')
 *         → harmony 侧 OpeninstallTurboModule(ets)
 *
 * 因此这里固化的是鸿蒙适配的契约:
 *   1. 平台行为:Platform.OS === 'harmony' 下各静态方法的委托语义
 *   2. TurboModule 注册名:原生侧必须以 'OpeninstallModule' 名字注册
 *      (OpeninstallReactNativeTurboModulesFactory 的 TM.OpeninstallModule.NAME)
 *   3. 回调/Promise 语义:getInstall 的空值归一(iOS/文档契约)、拉起参数经
 *      'OpeninstallWakeupCallBack' 事件下发、上报接口透传原生 Promise
 *   4. 平台守卫:Android/iOS 专有接口在鸿蒙上为 no-op(含原排除法分支
 *      修正的回归:configIOS/init 不再把 harmony 误入 iOS 分支)
 */

// 必须在 src/index.ts 加载前设置解析结果(require 不做 hoist,顺序可控)
const { Platform, TurboModuleRegistry, DeviceEventEmitter } = require('react-native');
const nativeMock = require('../__mocks__/NativeOpeninstall');
TurboModuleRegistry.get.mockReturnValue(nativeMock);

const openinstall = require('../../src/index').default;

/** 等待原生 Promise 的 .then 回调(挂到已 resolve 的 promise 上)跑完 */
async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('配置与初始化 (Platform.OS = harmony)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'harmony';
  });

  it('configAndroid(options) 把配置项原样委托给原生 config', () => {
    const options = { adEnabled: true, oaid: 'oaid-x', macAddress: '00:11:22' };

    openinstall.configAndroid(options);

    expectDelegatedTo(nativeMock.config, options);
  });

  it('旧版 config(adEnabled, oaid, gaid) 在鸿蒙为 no-op(Android 专有)', () => {
    openinstall.config(true, 'oaid-x', 'gaid-y');

    expect(nativeMock.config).not.toHaveBeenCalled();
  });

  it('configIOS(options) 在鸿蒙为 no-op(回归:原排除法分支会把 harmony 误入 iOS)', () => {
    openinstall.configIOS({ ASAEnabled: true, idfaStr: 'idfa' });

    expect(nativeMock.config).not.toHaveBeenCalled();
  });

  it('serialEnabled 在鸿蒙为 no-op(设备序列号开关,鸿蒙 SDK 无对应能力)', () => {
    openinstall.serialEnabled(true);

    expect(nativeMock.config).not.toHaveBeenCalled();
    expect(nativeMock.clipBoardEnabled).not.toHaveBeenCalled();
  });

  it('clipBoardEnabled(enabled) 委托原生(映射 OpInitConfig.fetchPasteData)', () => {
    openinstall.clipBoardEnabled(false);

    expectDelegatedTo(nativeMock.clipBoardEnabled, false);
  });

  it('init() 无参时只调用原生 init,不先行 config', () => {
    openinstall.init();

    expect(nativeMock.init).toHaveBeenCalledTimes(1);
    expect(nativeMock.config).not.toHaveBeenCalled();
  });

  it('init(options) 等价于先 config(options) 再 init()(顺序固化)', () => {
    const options = { adEnabled: false, oaid: 'oaid-y' };

    openinstall.init(options);

    expectDelegatedTo(nativeMock.config, options);
    expectDelegatedTo(nativeMock.init);
    expect(nativeMock.config.mock.invocationCallOrder[0]).toBeLessThan(
      nativeMock.init.mock.invocationCallOrder[0]
    );
  });
});

describe('getInstall 契约 (harmony)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'harmony';
  });

  it('以单参签名委托原生 getInstall(timeoutSeconds)', async () => {
    nativeMock.getInstall.mockResolvedValueOnce({ channel: 'c', data: 'd' });

    openinstall.getInstall(10, () => {});

    expectDelegatedTo(nativeMock.getInstall, 10);
    await flush();
  });

  it('channel/data 均有值时回调完整对象,shouldRetry 缺省为 false', async () => {
    nativeMock.getInstall.mockResolvedValueOnce({ channel: 'huawei', data: '{"k":1}' });

    let received;
    openinstall.getInstall(10, (result) => {
      received = result;
    });
    await flush();

    expect(received).toStrictEqual({ channel: 'huawei', data: '{"k":1}', shouldRetry: false });
  });

  it('channel/data/错误信息均为空时回调 null(iOS/文档契约)', async () => {
    nativeMock.getInstall.mockResolvedValueOnce({});

    let received;
    openinstall.getInstall(15, (result) => {
      received = result;
    });
    await flush();

    expect(received).toBeNull();
  });

  it('channel 为空串时归一为 null,保留 data 与 shouldRetry 透传', async () => {
    nativeMock.getInstall.mockResolvedValueOnce({ channel: '', data: 'd', shouldRetry: true });

    let received;
    openinstall.getInstall(10, (result) => {
      received = result;
    });
    await flush();

    expect(received).toStrictEqual({ channel: null, data: 'd', shouldRetry: true });
  });

  it('仅错误信息时回调 { channel: null, data: null, shouldRetry: false, message }', async () => {
    nativeMock.getInstall.mockResolvedValueOnce({ message: 'fetch failed' });

    let received;
    openinstall.getInstall(10, (result) => {
      received = result;
    });
    await flush();

    expect(received).toStrictEqual({
      channel: null,
      data: null,
      shouldRetry: false,
      message: 'fetch failed',
    });
  });

  it('getInstallCanRetry 在鸿蒙为 no-op(Android 专有)', async () => {
    let invoked = false;
    openinstall.getInstallCanRetry(10, () => {
      invoked = true;
    });
    await flush();

    expect(invoked).toBe(false);
    expect(nativeMock.getInstall).not.toHaveBeenCalled();
  });
});

describe('拉起参数监听 (harmony)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'harmony';
  });

  it('addWakeUpListener 无参调用原生 getWakeUp,并注册事件监听', () => {
    openinstall.addWakeUpListener(() => {});

    expectDelegatedTo(nativeMock.getWakeUp);
    expect(DeviceEventEmitter.addListener).toHaveBeenCalledWith(
      'OpeninstallWakeupCallBack',
      expect.any(Function)
    );
  });

  it("'OpeninstallWakeupCallBack' 事件下发触发回调(冷启动重放同通道)", async () => {
    const received = [];
    openinstall.addWakeUpListener((result) => received.push(result));
    const handler = DeviceEventEmitter.addListener.mock.calls[0][1];

    // 原生 emitDeviceEvent 下发拉起参数;冷启动暂存数据在注册后同样经此重放
    handler({ channel: 'wechat', data: '{"path":"/a"}' });
    handler(null);

    expect(received).toEqual([{ channel: 'wechat', data: '{"path":"/a"}' }, null]);
  });

  it('removeWakeUpListener 移除对应的订阅', () => {
    const cb = () => {};
    openinstall.addWakeUpListener(cb);
    const subscription = DeviceEventEmitter.addListener.mock.results[0].value;

    openinstall.removeWakeUpListener(cb);

    expect(subscription.remove).toHaveBeenCalledTimes(1);
  });

  it('removeWakeUpListener 对未注册的回调安全 no-op', () => {
    expect(() => openinstall.removeWakeUpListener(() => {})).not.toThrow();
    expect(DeviceEventEmitter.addListener).not.toHaveBeenCalled();
  });

  it('getWakeUpAlwaysCallback 在鸿蒙为 no-op(不触碰原生、不注册事件)', () => {
    expect(() => openinstall.getWakeUpAlwaysCallback(() => {})).not.toThrow();

    expect(nativeMock.getWakeUp).not.toHaveBeenCalled();
    expect(DeviceEventEmitter.addListener).not.toHaveBeenCalled();
  });
});

describe('上报接口 (harmony)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'harmony';
  });

  it('reportRegister 透传原生返回的同一 Promise', async () => {
    const nativePromise = Promise.resolve();
    nativeMock.reportRegister.mockReturnValueOnce(nativePromise);

    expect(openinstall.reportRegister()).toBe(nativePromise);
    await nativePromise;
  });

  it('reportEffectPoint 三参委托并透传 Promise', async () => {
    const nativePromise = Promise.resolve();
    nativeMock.reportEffectPoint.mockReturnValueOnce(nativePromise);

    const pending = openinstall.reportEffectPoint('point-1', 9900, { sku: 'A' });

    expectDelegatedTo(nativeMock.reportEffectPoint, 'point-1', 9900, { sku: 'A' });
    expect(pending).toBe(nativePromise);
    await nativePromise;
  });

  it('reportEffectPoint 省略 extraMap 时第三参为 undefined', async () => {
    nativeMock.reportEffectPoint.mockResolvedValueOnce(undefined);

    await openinstall.reportEffectPoint('point-2', 1);

    expectDelegatedTo(nativeMock.reportEffectPoint, 'point-2', 1, undefined);
  });

  it('reportShare 以双参签名委托,resolve 后回调结果', async () => {
    const shareResult = { shouldRetry: true, message: 'timeout' };
    nativeMock.reportShare.mockResolvedValueOnce(shareResult);

    let received;
    openinstall.reportShare('code-1', 'WECHAT', (result) => {
      received = result;
    });

    expectDelegatedTo(nativeMock.reportShare, 'code-1', 'WECHAT');
    await flush();
    expect(received).toBe(shareResult);
  });
});
