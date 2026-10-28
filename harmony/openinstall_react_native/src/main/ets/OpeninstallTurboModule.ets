/**
 * OpeninstallModule TurboModule（ArkTS 桥接层）。
 *
 * 以 OpenInstall 官方鸿蒙 SDK @openinstall/sdk 为唯一底座，对齐原
 * Android/iOS 原生模块（OpeninstallModule.java / RCTOpenInstall.m）的对外行为：
 *
 * - 字段映射：SDK OpData{channelCode, bindData} → JS 契约 {channel, data}
 *   （bindData 为 object，序列化为字符串以对齐 Android getData() 的 data 契约）；
 * - 空值语义：安装/拉起数据 channel 与 data 均为空时 JS 回调 null（iOS/文档语义）；
 * - 事件：拉起参数经 RCTDeviceEventEmitter 事件 'OpeninstallWakeupCallBack' 下发；
 * - 暂存重放：监听注册前解析出的拉起数据暂存，注册（getWakeUp）时重放
 *   （对齐 Android wakeupDataHolder）；init 前到达的 Want 暂存到 init 后处理
 *   （对齐 Android wakeupIntent）；
 * - 错误映射：getInstall 错误 → {shouldRetry, message}（TIMEOUT/REQUEST_FAIL 可重试）；
 *   reportShare 网络类失败 shouldRetry=true，其余 false（保守归类）。
 */

import { UITurboModule, UITurboModuleContext } from '@rnoh/react-native-openharmony/ts';
import { TM } from './generated/ts';
import { OpenInstall, OpCallback, OpData, OpError, OpInitConfig } from '@openinstall/sdk';
import { Want } from '@kit.AbilityKit';
import { OpeninstallBridge, OpeninstallWakeUpHandler } from './OpeninstallBridge';

/** getInstall 返回给 JS 的结果结构（错误时 channel/data 为空、message 非空）。 */
interface OpInstallResult {
  channel: string;
  data: string;
  shouldRetry: boolean;
  message: string;
}

/** reportShare 返回给 JS 的结果结构。 */
interface OpShareResult {
  shouldRetry: boolean;
  message: string;
}

/** 拉起事件下发给 JS 的 payload 结构。 */
interface OpWakeUpData {
  channel: string;
  data: string;
}

/** 暂存的拉起数据（监听注册前到达时持有，注册后重放）。 */
interface HeldWakeUp {
  channel: string;
  data: string;
  isEmpty: boolean;
}

const WAKEUP_EVENT_NAME = 'OpeninstallWakeupCallBack';

export class OpeninstallTurboModule
  extends UITurboModule
  implements TM.OpeninstallModule.Spec, OpeninstallWakeUpHandler
{
  public static readonly NAME = TM.OpeninstallModule.NAME;

  /** 监听注册前解析出的拉起数据（对齐 Android wakeupDataHolder）。 */
  private heldWakeUp: HeldWakeUp | null = null;
  /** JS 是否已注册拉起监听（addWakeUpListener → getWakeUp）。 */
  private registerWakeup: boolean = false;
  /** SDK init 是否已完成。 */
  private initialized: boolean = false;
  /** init 前到达的拉起 Want（对齐 Android wakeupIntent）。 */
  private preInitWant: Want | null = null;
  /** config()/clipBoardEnabled() 在 init 前暂存的配置（对齐 Android configuration）。 */
  private cfgAdEnabled: boolean | undefined = undefined;
  private cfgOaid: string | undefined = undefined;
  private cfgMacAddress: string | undefined = undefined;
  private cfgClipBoardEnabled: boolean | undefined = undefined;

  constructor(ctx: UITurboModuleContext) {
    super(ctx);
    // 构造即接管：onNewWant 路由到本实例；未投递的 Want 立即重放
    OpeninstallBridge.attach(this);
  }

  /** config(options)：init 前配置。仅消费鸿蒙 OpInitConfig 真实支持的键。 */
  config(options?: Object): void {
    if (options === undefined || options === null) {
      return;
    }
    const rec = options as Record<string, Object>;
    if (rec['adEnabled'] === true) {
      this.cfgAdEnabled = true;
    }
    const oaid = rec['oaid'];
    if (oaid !== undefined && oaid !== null) {
      this.cfgOaid = String(oaid);
    }
    const macAddress = rec['macAddress'];
    if (macAddress !== undefined && macAddress !== null) {
      this.cfgMacAddress = String(macAddress);
    }
  }

  /** clipBoardEnabled(enabled)：剪贴板免填邀请码开关，映射 OpInitConfig.fetchPasteData。 */
  clipBoardEnabled(enabled: boolean): void {
    this.cfgClipBoardEnabled = enabled;
  }

  /** init()：preInit 兜底 + OpenInstall.init(context, config)。 */
  init(): void {
    // 每次调用即时读取上下文（TurboModule 可能在上下文就绪前被急切实例化）
    const context = this.ctx.uiAbilityContext;
    OpeninstallBridge.ensurePreInit(context);
    const config = new OpInitConfig();
    if (this.cfgAdEnabled === true) {
      config.adEnabled = true;
    }
    if (this.cfgOaid !== undefined) {
      config.oaid = this.cfgOaid;
    }
    if (this.cfgMacAddress !== undefined) {
      config.macAddress = this.cfgMacAddress;
    }
    if (this.cfgClipBoardEnabled === false) {
      config.disableFetchPasteData();
    }
    OpenInstall.init(context, config);
    this.initialized = true;
    this.ctx.logger.info('Openinstall init completed');
    // 对齐 Android initialized()：处理 init 前到达的拉起 Want
    const pending = this.preInitWant;
    if (pending !== null) {
      this.preInitWant = null;
      this.queryWakeUp(pending);
    }
  }

  /**
   * getInstall(timeoutSeconds)：App 传参安装。错误不 reject，而是以
   * {shouldRetry, message} 的结果结构 resolve（对齐 Android 始终回调的契约）。
   */
  getInstall(timeoutSeconds: number): Promise<Object> {
    return new Promise<Object>((resolve: (value: Object) => void) => {
      const timeout = timeoutSeconds > 0 ? timeoutSeconds : 10;
      const callback: OpCallback<OpData> = {
        onResult: (result: OpData): void => {
          this.ctx.logger.info('Openinstall getInstall onResult');
          resolve(this.installResultFromOpData(result));
        },
        onError: (err: OpError): void => {
          this.ctx.logger.warn(`Openinstall getInstall onError: ${err.code} ${err.message ?? ''}`);
          resolve(this.installResultFromOpError(err));
        },
      };
      try {
        OpenInstall.getInstall(timeout, callback);
      } catch (e) {
        // SDK 同步抛出（如内部前置校验异常）也保证「始终回调」契约：转错误结果 resolve，不 reject
        const thrown: Object = e as Object;
        this.ctx.logger.warn(`Openinstall getInstall sync throw: ${OpeninstallTurboModule.throwMessage(thrown)}`);
        resolve(OpeninstallTurboModule.installResultFromThrow(thrown));
      }
    });
  }

  /** getWakeUp()：注册拉起监听；重放暂存数据或消费冷启动 Want。 */
  getWakeUp(): void {
    this.registerWakeup = true;
    const held = this.heldWakeUp;
    if (held !== null) {
      this.heldWakeUp = null;
      this.dispatchWakeUp(held.channel, held.data, held.isEmpty);
      return;
    }
    const launchWant = OpeninstallBridge.consumeLaunchWant();
    if (launchWant !== null) {
      if (!this.initialized) {
        this.preInitWant = launchWant;
      } else {
        this.queryWakeUp(launchWant);
      }
    }
  }

  /** reportRegister()：注册量统计。 */
  reportRegister(): Promise<void> {
    return OpenInstall.reportRegister();
  }

  /** reportEffectPoint()：效果点统计；extraMap 由 object 转为 Map<string,string>。 */
  reportEffectPoint(effectID: string, effectValue: number, extraMap?: Object): Promise<void> {
    if (effectID.length === 0 || effectValue < 0) {
      return new Promise<void>(
        (resolve: (value: void) => void, reject: (reason: Error) => void) => {
          reject(new Error('reportEffectPoint 调用失败：pointId 不能为空，pointValue 必须大于等于0'));
        }
      );
    }
    let extraMapConverted: Map<string, string> | undefined = undefined;
    if (extraMap !== undefined && extraMap !== null) {
      extraMapConverted = this.toStringMap(extraMap);
    }
    return OpenInstall.reportEffectPoint(effectID, effectValue, extraMapConverted);
  }

  /**
   * reportShare()：裂变分享统计。参数校验失败直接以
   * {shouldRetry:false, message} resolve（对齐 Android 回调契约）。
   */
  reportShare(shareCode: string, sharePlatform: string): Promise<Object> {
    return new Promise<Object>((resolve: (value: Object) => void) => {
      if (shareCode.length === 0 || sharePlatform.length === 0) {
        const invalid: OpShareResult = {
          shouldRetry: false,
          message: 'shareCode 和 sharePlatform 不能为空',
        };
        resolve(invalid);
        return;
      }
      const callback: OpCallback<void> = {
        onResult: (): void => {
          const ok: OpShareResult = { shouldRetry: false, message: '' };
          resolve(ok);
        },
        onError: (err: OpError): void => {
          this.ctx.logger.warn(`Openinstall reportShare onError: ${err.code} ${err.message ?? ''}`);
          const failed: OpShareResult = {
            shouldRetry: OpeninstallTurboModule.isRetryableError(err),
            message: OpeninstallTurboModule.errorMessage(err),
          };
          resolve(failed);
        },
      };
      try {
        OpenInstall.reportShare(shareCode, sharePlatform, callback);
      } catch (e) {
        // 同步抛出同样以 {shouldRetry:false, message} resolve，保证 JS 回调必达（Android 契约）
        const thrown: Object = e as Object;
        this.ctx.logger.warn(`Openinstall reportShare sync throw: ${OpeninstallTurboModule.throwMessage(thrown)}`);
        const failed: OpShareResult = {
          shouldRetry: false,
          message: OpeninstallTurboModule.throwMessage(thrown),
        };
        resolve(failed);
      }
    });
  }

  /** OpeninstallWakeUpHandler：onNewWant 路由（init 前暂存，init 后解析）。 */
  onWakeUpWant(want: Want): void {
    if (!this.initialized) {
      this.preInitWant = want;
      return;
    }
    this.queryWakeUp(want);
  }

  /** 调 SDK 解析拉起 Want：结果经事件下发或暂存。 */
  private queryWakeUp(want: Want): void {
    const callback: OpCallback<OpData> = {
      onResult: (result: OpData): void => {
        this.ctx.logger.info('Openinstall getWakeUp onResult');
        if (result.isEmpty()) {
          this.dispatchWakeUp('', '', true);
          return;
        }
        this.dispatchWakeUp(
          result.channelCode ?? '',
          this.stringifyBindData(result.bindData),
          false
        );
      },
      onError: (err: OpError): void => {
        // 非拉起链接启动（图标点开等）为 INVALID_INTENT，按空数据下发 null（iOS 语义）
        if (err.code === OpError.INVALID_INTENT) {
          this.dispatchWakeUp('', '', true);
          return;
        }
        this.ctx.logger.warn(`Openinstall getWakeUp onError: ${err.code} ${err.message ?? ''}`);
      },
    };
    OpenInstall.getWakeUp(want, callback);
  }

  /** 已注册监听 → 直接 emit；未注册 → 暂存待注册时重放（Android 语义）。 */
  private dispatchWakeUp(channel: string, data: string, isEmpty: boolean): void {
    if (!this.registerWakeup) {
      const held: HeldWakeUp = { channel: channel, data: data, isEmpty: isEmpty };
      this.heldWakeUp = held;
      return;
    }
    if (isEmpty) {
      this.ctx.rnInstance?.emitDeviceEvent(WAKEUP_EVENT_NAME, null);
      return;
    }
    const payload: OpWakeUpData = { channel: channel, data: data };
    this.ctx.rnInstance?.emitDeviceEvent(WAKEUP_EVENT_NAME, payload);
  }

  private installResultFromOpData(result: OpData): OpInstallResult {
    if (result.isEmpty()) {
      const empty: OpInstallResult = { channel: '', data: '', shouldRetry: false, message: '' };
      return empty;
    }
    const ok: OpInstallResult = {
      channel: result.channelCode ?? '',
      data: this.stringifyBindData(result.bindData),
      shouldRetry: false,
      message: '',
    };
    return ok;
  }

  private installResultFromOpError(err: OpError): OpInstallResult {
    const failed: OpInstallResult = {
      channel: '',
      data: '',
      shouldRetry: OpeninstallTurboModule.isRetryableError(err),
      message: OpeninstallTurboModule.errorMessage(err),
    };
    return failed;
  }

  /** 仅明确可重试的错误置 true：超时、网络请求失败。 */
  private static isRetryableError(err: OpError): boolean {
    return err.code === OpError.TIMEOUT || err.code === OpError.REQUEST_FAIL;
  }

  /** 同步抛出的异常 → getInstall 错误结果结构（Promise 不 reject、JS 回调必达）。 */
  private static installResultFromThrow(e: Object): OpInstallResult {
    if (e instanceof OpError) {
      const opFailed: OpInstallResult = {
        channel: '',
        data: '',
        shouldRetry: OpeninstallTurboModule.isRetryableError(e),
        message: OpeninstallTurboModule.errorMessage(e),
      };
      return opFailed;
    }
    const failed: OpInstallResult = {
      channel: '',
      data: '',
      shouldRetry: false,
      message: OpeninstallTurboModule.throwMessage(e),
    };
    return failed;
  }

  /** 提取同步抛出异常的可读消息（Error 取 message，其余 String() 归一）。 */
  private static throwMessage(e: Object): string {
    if (e instanceof Error && e.message.length > 0) {
      return e.message;
    }
    return String(e);
  }

  private static errorMessage(err: OpError): string {
    if (err.message !== undefined && err.message !== null && err.message.length > 0) {
      return err.message;
    }
    return `OpenInstall error ${err.code}`;
  }

  /** bindData(object) → data 字符串：字符串原样返回，其余 JSON 序列化。 */
  private stringifyBindData(bindData: Object | undefined | null): string {
    if (bindData === undefined || bindData === null) {
      return '';
    }
    if (typeof bindData === 'string') {
      return bindData as string;
    }
    return JSON.stringify(bindData);
  }

  /** JS object → Map<string,string>（null 值跳过，其余 String() 归一，对齐 Android）。 */
  private toStringMap(source: Object): Map<string, string> {
    const result = new Map<string, string>();
    const rec = source as Record<string, Object>;
    const keys = Object.keys(rec);
    for (const key of keys) {
      const value = rec[key];
      if (value === undefined || value === null) {
        continue;
      }
      if (typeof value === 'string') {
        result.set(key, value as string);
      } else {
        result.set(key, String(value));
      }
    }
    return result;
  }
}
