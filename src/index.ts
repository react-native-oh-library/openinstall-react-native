import {
  NativeModules,
  Platform,
  DeviceEventEmitter,
  TurboModuleRegistry,
} from 'react-native';
import type { EmitterSubscription } from 'react-native';
import type { Spec } from './specs/v1/NativeOpeninstallModule';

/**
 * openinstall React Native 插件（鸿蒙适配版 JS 层）。
 *
 * - harmony：TurboModuleRegistry.get('OpeninstallModule')（新架构）；
 * - android/ios：沿用原 NativeModules.OpeninstallModule（旧架构），行为不变。
 * - 平台判断全部改为显式 === 判断，修正原 index.js 的排除法分支
 *   （原 configIOS/init 在非 android 平台会把 harmony 误入 iOS 分支）。
 */

/** 拉起参数（channel 与 data 均为空时为 null）。 */
export type WakeUpResult = { channel: string | null; data: string | null } | null;

/** 安装参数（channel 与 data 均为空且无错误信息时为 null）。 */
export type InstallResult = {
  channel: string | null;
  data: string | null;
  shouldRetry?: boolean;
  message?: string;
} | null;

/** 分享上报回调结果。 */
export type ShareResult = { shouldRetry: boolean; message?: string };

/** configAndroid / init 可配置项（鸿蒙 OpInitConfig 真实支持项）。 */
export interface OpeninstallAndroidOptions {
  adEnabled?: boolean;
  oaid?: string;
  macAddress?: string;
  [key: string]: unknown;
}

/** 旧架构（android/ios）原生模块方法面（可选成员以兼容两端差异）。 */
interface LegacyOpeninstallModule {
  config(options: OpeninstallAndroidOptions | Record<string, unknown>): void;
  initSDK?(options?: Record<string, unknown>): void;
  init?(): void;
  serialEnabled?(enabled: boolean): void;
  clipBoardEnabled?(enabled: boolean): void;
  getInstall?(s: number, cb: (result: unknown) => void): void;
  getInstallCanRetry?(s: number, cb: (result: unknown) => void): void;
  getWakeUp?(cb?: (result: unknown) => void): void;
  getWakeUpAlwaysCallback?(cb: (result: unknown) => void): void;
  reportRegister?(): void;
  reportEffectPoint?(
    effectID: string,
    effectValue: number,
    extraMap?: Record<string, unknown>
  ): void;
  reportShare?(
    shareCode: string,
    sharePlatform: string,
    cb: (result: unknown) => void
  ): void;
}

type NativeModule = (Spec & LegacyOpeninstallModule) | undefined;

// RNOH 运行时 Platform.OS 为 'harmony'；官方 react-native 0.72 类型未含该字面量，
// 以 string 比较（运行时行为不变，仍为严格相等判断）。
const OS: string = Platform.OS;

const Native: NativeModule =
  OS === 'harmony'
    ? (TurboModuleRegistry.get<Spec>('OpeninstallModule') as NativeModule)
    : (NativeModules.OpeninstallModule as NativeModule);

const receiveWakeUpEvent = 'OpeninstallWakeupCallBack';
const listenerMap = new Map<(result: WakeUpResult) => void, EmitterSubscription>();

export default class openinstall {
  /**
   * 旧版本接口（1.5.0 版本废除）。Android 专有（gaid 鸿蒙无对应概念）。
   */
  static config(adEnabled: boolean, oaid?: string, gaid?: string): void {
    if (OS === 'android') {
      Native?.config({ adEnabled, oaid, gaid });
    } else {
      // ignore, platform unsupport
    }
  }

  /**
   * 1.5.0 版本新增，替换 config(adEnabled, oaid, gaid) 接口。
   * 鸿蒙承接 OpInitConfig 支持的配置项：adEnabled / oaid / macAddress
   * （gaid、imei 等 Android 专有项鸿蒙无对应，忽略）。
   * @param options 配置 {adEnabled: true, oaid: "...", macAddress: "..."}
   */
  static configAndroid(options: OpeninstallAndroidOptions): void {
    if (OS === 'android' || OS === 'harmony') {
      Native?.config(options);
    } else {
      // ignore, platform unsupport
    }
  }

  /**
   * 1.8.0 新增，在初始化 init 前调用。iOS 专有（ASA/idfa/caid 为苹果广告生态，
   * 鸿蒙不映射）。
   */
  static configIOS(options: Record<string, unknown>): void {
    if (OS === 'ios') {
      Native?.config(options);
    } else {
      // ignore, platform unsupport
    }
  }

  /**
   * Android 专有（设备序列号开关），鸿蒙 SDK 无对应能力。
   */
  static serialEnabled(enabled: boolean): void {
    if (OS === 'android') {
      Native?.serialEnabled?.(enabled);
    } else {
      // ignore, platform unsupport
    }
  }

  /**
   * 剪贴板免填邀请码（场景还原）开关，须在 init 前调用。
   * 鸿蒙映射 OpInitConfig.fetchPasteData（默认开启）。
   */
  static clipBoardEnabled(enabled: boolean): void {
    if (OS === 'android' || OS === 'harmony') {
      Native?.clipBoardEnabled?.(enabled);
    } else {
      // ignore, platform unsupport
    }
  }

  /**
   * 初始化。
   * @param options 鸿蒙可传 {adEnabled, oaid, macAddress}（等价于先 configAndroid 再 init）；
   * iOS 可选择配置 {ASA, ASAEnabled, ASADebug, adEnabled, idfaStr, caid1, caid2}。
   */
  static init(options?: OpeninstallAndroidOptions | Record<string, unknown>): void {
    if (OS === 'android') {
      Native?.init?.();
    } else if (OS === 'harmony') {
      if (options) {
        Native?.config(options as OpeninstallAndroidOptions);
      }
      Native?.init();
    } else {
      Native?.initSDK?.(options as Record<string, unknown> | undefined);
    }
  }

  /**
   * 获取安装动态参数。
   * @param s 超时时长（秒），一般为 10~15s；如果只是在后台默默统计或使用参数，可以设置更长时间
   * @param cb 结果回调；data 和 channel 都为空且无错误信息时返回 null
   */
  static getInstall(s: number, cb: (result: InstallResult) => void): void {
    if (OS === 'harmony') {
      Native?.getInstall(s)?.then((result: Object) => {
        const r = result as {
          channel?: string;
          data?: string;
          shouldRetry?: boolean;
          message?: string;
        };
        if (!r.channel && !r.data && !r.message) {
          cb(null);
          return;
        }
        cb({
          channel: r.channel || null,
          data: r.data || null,
          shouldRetry: r.shouldRetry ?? false,
          ...(r.message ? { message: r.message } : {}),
        });
      });
      return;
    }
    Native?.getInstall?.(s, (result: unknown) => cb(result as InstallResult));
  }

  /**
   * 获取安装动态参数，不会中断初始化读取匹配数据，重试可获取数据（Android 专有）。
   * @param s 超时时长（秒）
   * @param cb 结果回调
   */
  static getInstallCanRetry(s: number, cb: (result: InstallResult) => void): void {
    if (OS === 'android') {
      Native?.getInstallCanRetry?.(s, (result: unknown) =>
        cb(result as InstallResult)
      );
    }
  }

  /**
   * 监听 universal link / scheme / App Linking 拉起参数回调的方法。
   * 拉起参数经事件 'OpeninstallWakeupCallBack' 下发；冷启动参数在注册后重放。
   * @param cb 结果回调；data 和 channel 都为空时返回 null
   */
  static addWakeUpListener(cb: (result: WakeUpResult) => void): void {
    if (OS === 'harmony') {
      Native?.getWakeUp();
    } else {
      Native?.getWakeUp?.((result: unknown) => cb(result as WakeUpResult));
    }
    const subscription = DeviceEventEmitter.addListener(receiveWakeUpEvent, result => {
      cb(result as WakeUpResult);
    });
    listenerMap.set(cb, subscription);
  }

  /**
   * Android 监听 scheme 拉起参数回调，不管是否有数据都会回调（Android 专有）。
   * @param cb 结果回调
   */
  static getWakeUpAlwaysCallback(cb: (result: WakeUpResult) => void): void {
    if (OS === 'android') {
      Native?.getWakeUpAlwaysCallback?.((result: unknown) =>
        cb(result as WakeUpResult)
      );
      const subscription = DeviceEventEmitter.addListener(receiveWakeUpEvent, result => {
        cb(result as WakeUpResult);
      });
      listenerMap.set(cb, subscription);
    }
  }

  /**
   * 取消监听。
   * @param cb addWakeUpListener / getWakeUpAlwaysCallback 注册的回调
   */
  static removeWakeUpListener(cb: (result: WakeUpResult) => void): void {
    const subscription = listenerMap.get(cb);
    if (!subscription) {
      return;
    }
    subscription.remove();
    listenerMap.delete(cb);
  }

  /**
   * 上报注册事件（注册量统计）。
   * 鸿蒙端返回 Promise（成功 resolve / 失败 reject，携带 SDK 错误码），可选择性使用。
   */
  static reportRegister(): Promise<void> {
    return Native?.reportRegister?.() ?? Promise.resolve();
  }

  /**
   * 上报效果点。
   * @param effectID 效果点 ID（需在 OpenInstall 控制台预建）
   * @param effectValue 效果点值（金额以分计）
   * @param extraMap 效果点明细自定义参数
   * 鸿蒙端返回 Promise（成功 resolve / 失败 reject），可选择性使用。
   */
  static reportEffectPoint(
    effectID: string,
    effectValue: number,
    extraMap?: Record<string, string | number>
  ): Promise<void> {
    if (OS === 'harmony') {
      return (
        Native?.reportEffectPoint(effectID, effectValue, extraMap as Object | undefined) ??
        Promise.resolve()
      );
    }
    Native?.reportEffectPoint?.(effectID, effectValue, extraMap);
    return Promise.resolve();
  }

  /**
   * 裂变分享统计。
   * @param shareCode 分享 ID
   * @param sharePlatform 分享平台，参考官网平台列表
   * @param func 分享回调，参数为 {shouldRetry: boolean, message?: string}
   */
  static reportShare(
    shareCode: string,
    sharePlatform: string,
    func: (result: ShareResult) => void
  ): void {
    if (OS === 'harmony') {
      Native?.reportShare(shareCode, sharePlatform)?.then((result: Object) => {
        func(result as ShareResult);
      });
      return;
    }
    Native?.reportShare?.(shareCode, sharePlatform, (result: unknown) =>
      func(result as ShareResult)
    );
  }
}
