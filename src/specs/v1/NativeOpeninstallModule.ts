import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * OpeninstallModule TurboModule Spec（旧架构 NativeModules.OpeninstallModule 手写转新架构）。
 *
 * 模块名必须与 JS 侧 TurboModuleRegistry.get('OpeninstallModule') 完全一致
 * （codegen 由文件名 NativeOpeninstallModule 派生 NAME = 'OpeninstallModule'）。
 *
 * 方法面对照原 Android/iOS 原生实现，仅保留鸿蒙 @openinstall/sdk 有真实等价能力的方法；
 * Android 专有 API（getInstallCanRetry / serialEnabled / getWakeUpAlwaysCallback）在
 * JS 层有 android 守卫、鸿蒙 SDK 无等价，不纳入本 Spec。
 *
 * 拉起参数不经方法返回，而是经 RCTDeviceEventEmitter 事件
 * 'OpeninstallWakeupCallBack' 下发（ArkTS 侧 rnInstance.emitDeviceEvent）。
 */
export interface Spec extends TurboModule {
  /**
   * 初始化前配置。可配置项（鸿蒙 OpInitConfig 真实支持项）：
   * { adEnabled?: boolean, oaid?: string, macAddress?: string }
   * Android 专有项（gaid/imei/serialNumber/androidId 等）鸿蒙无等价，忽略。
   */
  config(options: Object): void;

  /** 初始化 SDK（内部完成 preInit 兜底 + OpenInstall.init(context, config)）。 */
  init(): void;

  /** 剪贴板免填邀请码开关（init 前调用；映射 OpInitConfig.fetchPasteData，默认开启）。 */
  clipBoardEnabled(enabled: boolean): void;

  /**
   * 获取安装动态参数（App 传参安装）。
   * 返回 { channel: string, data: string, shouldRetry: boolean, message?: string }；
   * channel/data 均为空且无错误信息时 JS 层按契约回调 null（iOS/文档语义）。
   */
  getInstall(timeoutSeconds: number): Promise<Object>;

  /**
   * 注册一键拉起监听：重放监听注册前暂存的拉起数据，或触发冷启动 Want 的解析。
   * 拉起数据经 'OpeninstallWakeupCallBack' 事件下发 { channel, data }，均空时为 null。
   */
  getWakeUp(): void;

  /** 上报注册事件（渠道注册量统计）。 */
  reportRegister(): Promise<void>;

  /** 上报效果点；extraMap 为效果点明细（Map<string,string>，由桥接层从 object 转换）。 */
  reportEffectPoint(
    effectID: string,
    effectValue: number,
    extraMap?: Object
  ): Promise<void>;

  /**
   * 裂变分享统计上报。
   * 返回 { shouldRetry: boolean, message: string }：网络类失败（请求失败/超时）
   * shouldRetry=true，其余（未初始化等）为 false。
   */
  reportShare(shareCode: string, sharePlatform: string): Promise<Object>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('OpeninstallModule');
