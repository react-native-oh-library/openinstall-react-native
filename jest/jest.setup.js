/**
 * 语义化别名,替代 Jest 内置的 expect(fn).toHaveBeenCalledWith(...args)。
 *
 * 内置名字只描述了机制("以这些参数被调用过"),读不出断言意图;本仓库的
 * JS 层(src/index.ts / codegen spec)用它验证的是"委托契约":被测入口把
 * 给定的参数(经正确变换后)转发给了底层依赖,即 TurboModuleRegistry /
 * NativeModules 解析出的原生模块。
 *
 * 示例:
 *   expectDelegatedTo(nativeMock.config, { adEnabled: true });
 *
 */
global.expectDelegatedTo = (mockFn, ...args) => {
  expect(mockFn).toHaveBeenCalledWith(...args);
};
