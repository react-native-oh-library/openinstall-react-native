/**
 * 手写 mock 的 `react-native` 包,白盒单测专用。
 *
 * 只实现 JS 层(src/index.ts)消费的四个出口:
 *   - Platform:测试内直接改写 OS 切换平台分支
 *   - TurboModuleRegistry:鸿蒙新架构入口,默认返回 undefined,
 *     用例按场景注入解析结果
 *   - NativeModules:android/ios 旧架构入口,OpeninstallModule
 *     可变,便于用例注入旧版模块
 *   - DeviceEventEmitter:拉起参数事件 'OpeninstallWakeupCallBack'
 *     的下发通道,addListener 返回带 remove 的订阅对象
 */

'use strict';

const Platform = {
  OS: 'harmony',
  select: (config) => config[Platform.OS],
};

const TurboModuleRegistry = {
  get: jest.fn(() => undefined),
  getEnforcing: jest.fn(() => undefined),
};

const NativeModules = {
  // 旧架构入口;android/ios 下 src/index.ts 从这里取 OpeninstallModule
  OpeninstallModule: undefined,
};

const DeviceEventEmitter = {
  addListener: jest.fn((_eventName, _handler) => ({ remove: jest.fn() })),
};

module.exports = {
  Platform,
  TurboModuleRegistry,
  NativeModules,
  DeviceEventEmitter,
};
