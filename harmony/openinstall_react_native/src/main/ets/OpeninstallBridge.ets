/**
 * OpeninstallBridge —— 宿主 UIAbility/AbilityStage 与 RN TurboModule 之间的生命周期桥。
 *
 * 宿主侧（Example 工程）接入方式：
 *   AbilityStage.onCreate()    → OpeninstallBridge.preInit(this.context)
 *   EntryAbility.onCreate()    → OpeninstallBridge.onAbilityCreate(want)
 *   EntryAbility.onNewWant()   → OpeninstallBridge.onAbilityNewWant(want)
 *
 * 语义对齐 Android 原实现（OpeninstallModule.java）：
 *   - 冷启动 Want 在 JS 注册拉起监听（getWakeUp）时消费（≈ currentActivity.getIntent()）；
 *   - init 前到达的 onNewWant Want 由 TurboModule 暂存，init 完成后处理（≈ wakeupIntent）；
 *   - 监听注册前已解析出的拉起数据由 TurboModule 暂存重放（≈ wakeupDataHolder）。
 */

import { OpenInstall } from '@openinstall/sdk';
import { common, Want } from '@kit.AbilityKit';

/** TurboModule 侧实现的拉起 Want 回调接口（避免 Bridge 反向依赖 TurboModule 类型）。 */
export interface OpeninstallWakeUpHandler {
  onWakeUpWant(want: Want): void;
}

export class OpeninstallBridge {
  private static readonly TAG = 'OpeninstallBridge';
  private static preInited: boolean = false;
  /** 冷启动 Want（EntryAbility.onCreate 传入，注册监听时消费，只消费一次）。 */
  private static launchWant: Want | null = null;
  private static launchWantConsumed: boolean = false;
  /** TurboModule 尚未创建时到达的 onNewWant Want（attach 后立即重放）。 */
  private static pendingNewWant: Want | null = null;
  private static handler: OpeninstallWakeUpHandler | null = null;

  /** SDK 预初始化（宿主 AbilityStage.onCreate 调用）。 */
  static preInit(context: common.AbilityStageContext): void {
    if (!OpeninstallBridge.preInited) {
      OpenInstall.preInit(context);
      OpeninstallBridge.preInited = true;
    }
  }

  /** SDK 预初始化兜底（TurboModule init 时若宿主未配置 AbilityStage 则由此补齐）。 */
  static ensurePreInit(context: common.UIAbilityContext): void {
    if (!OpeninstallBridge.preInited) {
      OpenInstall.preInit(context);
      OpeninstallBridge.preInited = true;
    }
  }

  /** 冷启动（EntryAbility.onCreate）。 */
  static onAbilityCreate(want: Want): void {
    OpeninstallBridge.launchWant = want;
    OpeninstallBridge.launchWantConsumed = false;
  }

  /** 热启动 / 已在后台被链接拉起（EntryAbility.onNewWant）。 */
  static onAbilityNewWant(want: Want): void {
    const h = OpeninstallBridge.handler;
    if (h != null) {
      h.onWakeUpWant(want);
    } else {
      OpeninstallBridge.pendingNewWant = want;
    }
  }

  /** TurboModule 构造时注册自身，并重放未投递的 Want。 */
  static attach(handler: OpeninstallWakeUpHandler): void {
    OpeninstallBridge.handler = handler;
    const pending = OpeninstallBridge.pendingNewWant;
    if (pending != null) {
      OpeninstallBridge.pendingNewWant = null;
      handler.onWakeUpWant(pending);
    }
  }

  /** 取走冷启动 Want（只消费一次；对齐 iOS wakeupStat 的“仅一次”语义，避免重复投递）。 */
  static consumeLaunchWant(): Want | null {
    if (OpeninstallBridge.launchWant == null || OpeninstallBridge.launchWantConsumed) {
      return null;
    }
    OpeninstallBridge.launchWantConsumed = true;
    return OpeninstallBridge.launchWant;
  }
}
