> 文档模板：v0.4.2

<p align="center">
  <h1 align="center"> <code>openinstall-react-native</code> </h1>
</p>

本项目基于 [openinstall-react-native](https://github.com/OpenInstall/openinstall-react-native) 开发。

版本所属关系如下：

| 三方库名称    | 三方库版本（npm地址）    | 发布信息     | 支持RN版本    | Autolink     | 编译API版本     | 社区基线版本    |  源码地址   |
| ------------ | ------------ | ------------------------------ | ------------- | ------------- |------------------------ | ------------- | ------------- | 
| @react-native-ohos/openinstall-react-native | [~ 2.0.0](https://www.npmjs.com/package/@react-native-ohos/openinstall-react-native)    | [Gitcode Releases](https://gitcode.com/CPF-RN/rntpc_openinstall-react-native/releases) | 0.84.* | 是 | API12+ | 2.0.0 | [master](https://gitcode.com/CPF-RN/rntpc_openinstall-react-native) |

## 简介

OpenInstall 插件用于 React Native。<br/>
OpenInstall 提供 App 、一键拉起（scheme / App Linking）、渠道统计、效果点统计与裂变分享统计等移动归因能力。<br/>
开发者无需在工程中手工拼接渠道参数，即可完成安装来源追踪与拉起参数还原。

## 下载安装

进入到工程目录并输入以下命令：

**npm**

```bash
npm install @react-native-ohos/openinstall-react-native
```

**yarn**

```bash
yarn add @react-native-ohos/openinstall-react-native
```

## Link

|                                      | 是否支持autolink | RN框架版本 |
|--------------------------------------|----------------|-----------|
| ~ 2.0.0                              | Yes            |  0.84     |

使用AutoLink的工程需要根据该文档配置，Autolink框架指导文档：https://gitcode.com/CPF-RN/ohos_react_native/blob/master/docs/zh-cn/Autolinking.md

如您使用的版本支持 Autolink，并且工程已接入 Autolink，可跳过ManualLink配置。
<details>
  <summary>ManualLink: 此步骤为手动配置原生依赖项的指导</summary>

首先需要使用 DevEco Studio 打开项目里的 HarmonyOS 工程 `harmony`。

### 1. Overrides RN SDK

为了让工程依赖同一个版本的 RN SDK，需要在工程根目录的 `oh-package.json5` 添加 overrides 字段，指向工程需要使用的 RN SDK 版本。替换的版本既可以是一个具体的版本号，也可以是一个模糊版本，还可以是本地存在的 HAR 包或源码目录。

关于该字段的作用请阅读[官方说明](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides-V5/ide-oh-package-json5-V5#zh-cn_topic_0000001792256137_overrides)

```json
{
  "overrides": {
    "@rnoh/react-native-openharmony": "^0.72.38" // ohpm 在线版本
    // "@rnoh/react-native-openharmony" : "./react_native_openharmony.har" // 指向本地 har 包的路径
    // "@rnoh/react-native-openharmony" : "./react_native_openharmony" // 指向源码路径
  }
}
```

### 2. 引入原生端代码

> [!TIP] har 包位于三方库安装路径的 `harmony` 文件夹下；原生底座依赖 `@openinstall/sdk`（OHPM）会随 har 包一并自动安装。

打开 `entry/oh-package.json5`，添加以下依赖

```json
"dependencies": {
    "@react-native-ohos/openinstall-react-native": "file:../../node_modules/@react-native-ohos/openinstall-react-native/harmony/openinstall_react_native.har"
  }
```

点击右上角的 `sync` 按钮

或者在命令行终端执行：

```bash
cd entry
ohpm install
```

### 3. 配置 CMakeLists

打开 `entry/src/main/cpp/CMakeLists.txt`，添加：

```diff
set(OH_MODULES "${CMAKE_CURRENT_SOURCE_DIR}/../../../oh_modules")

add_subdirectory("${RNOH_CPP_DIR}" ./rn)

+ add_subdirectory("${OH_MODULES}/@react-native-ohos/openinstall-react-native/src/main/cpp" ./openinstall_react_native)

add_library(rnoh_app SHARED
    "./PackageProvider.cpp"
    "${RNOH_CPP_DIR}/RNOHAppNapiBridge.cpp"
)
target_link_libraries(rnoh_app PUBLIC rnoh)

+ target_link_libraries(rnoh_app PUBLIC openinstall_react_native)
```

### 4. 注册 Package（C++ 侧）

打开 `entry/src/main/cpp/PackageProvider.cpp`，添加：

```diff
  #include "RNOH/PackageProvider.h"
+ #include "OpeninstallReactNativePackage.h"

  using namespace rnoh;

  std::vector<std::shared_ptr<Package>> PackageProvider::getPackages(Package::Context ctx) {
      return {
+       std::make_shared<OpeninstallReactNativePackage>(ctx),
      };
  }
```

### 5. 注册 Package（ArkTS 侧）

打开 `entry/src/main/ets/RNPackagesFactory.ets`，添加：

```diff
+ import { OpeninstallReactNativePackage } from '@react-native-ohos/openinstall-react-native/ts';

  export function createRNPackages(ctx: RNPackageContext): RNPackage[] {
    return [
+     new OpeninstallReactNativePackage(ctx),
    ];
  }
```

</details>

### 运行

点击右上角的 `sync` 按钮

或者在命令行终端执行：

```bash
cd entry
ohpm install
```

然后编译、运行即可。

## 约束与限制

### 兼容性

要使用此库，需要使用正确的 React-Native 和 RNOH 版本。另外，还需要使用配套的 DevEco Studio 和 手机 ROM。

1.RNOH: 0.84.2; SDK: HarmonyOS 6.0.0 Release SDK; IDE: DevEco Studio 6.0.0.878; ROM:6.0.0.130;

### 权限要求

本库运行需要以下权限（均为 normal 级系统授权），在 `entry/src/main/module.json5` 中添加：

```json
requestPermissions: [
  { "name": "ohos.permission.INTERNET" },
  { "name": "ohos.permission.GET_WIFI_INFO" },
  { "name": "ohos.permission.GET_BUNDLE_INFO" },
  { "name": "ohos.permission.STORE_PERSISTENT_DATA" },
],
```

### 编译运行API要求

> [!TIP] 当前三方库所有版本均已实现版本隔离，支持在 `API12+` 工程编译，及 `API12+` ROM运行。

## 使用示例

下面的代码展示了这个库的基本使用场景：

> [!WARNING] 使用时 import 的库名不变。

```javascript
import React from 'react';
import { View } from 'react-native';
import openinstall from 'openinstall-react-native';

export default class App extends React.Component {
  componentDidMount() {
    // 1. 初始化（可选配置：adEnabled / oaid / macAddress；clipBoardEnabled 须在 init 前调用）
    openinstall.clipBoardEnabled(true);
    openinstall.configAndroid({ adEnabled: true, oaid: 'xxx' });
    openinstall.init();

    // 2. 一键拉起（scheme / App Linking）：channel 与 data 均为空时回调 null
    openinstall.addWakeUpListener((wakeupResult) => {
      console.log('wake up:', wakeupResult);
    });

    // 3. App 传参安装：超时一般 10~15 秒；自然安装（无渠道参数）回调 null
    openinstall.getInstall(10, (installResult) => {
      console.log('install:', installResult);
    });

    // 4. 渠道统计
    openinstall.reportRegister();
    openinstall.reportEffectPoint('effect_test', 100, { goodsId: '10086' });

    // 5. 裂变分享统计
    openinstall.reportShare('c0011', 'QQ', (ret) => {
      console.log(ret.shouldRetry, ret.message);
    });
  }

  render() {
    return <View style={{ flex: 1 }} />;
  }
}
```

## 使用说明

### 宿主工程配置（必需）

1. **appkey**：在 `entry/src/main/module.json5` 的 `module.metadata` 配置 OpenInstall 控制台生成的 appkey：

```json5
{
  "module": {
    "metadata": [
      { "name": "com.openinstall.APP_KEY", "value": "你的 appkey" }
    ]
  }
}
```

2. **一键拉起**：在目标 Ability 的 `skills` 配置自定义 scheme 或 App Linking（https + 关联域名 + `domainVerify: true`，域名需在 AGC 发布），并建议 `launchType: "singleton"` 以保证热启动走 `onNewWant`。

3. **生命周期接管**：宿主需把 Want 交给插件（参考 Example）：

```typescript
// AbilityStage.onCreate
import { OpeninstallBridge } from '@react-native-ohos/openinstall-react-native';

OpeninstallBridge.preInit(this.context);

// EntryAbility.onCreate / onNewWant
OpeninstallBridge.onAbilityCreate(want);
OpeninstallBridge.onAbilityNewWant(want);
```

> 插件内部已对齐 Android 原实现语义：监听注册前到达的拉起数据暂存重放、init 前到达的 Want 暂存到 init 后处理；拉起参数经 `DeviceEventEmitter` 事件 `OpeninstallWakeupCallBack` 下发。

**初始化**

```javascript
openinstall.clipBoardEnabled(true);                      // 剪贴板免填邀请码开关（init 前调用）
openinstall.configAndroid({ adEnabled: true, oaid: 'xxx', macAddress: 'xxx' });
openinstall.init();                                       // 也可 openinstall.init({ adEnabled: true }) 等价于先 config 再 init
```

**一键拉起监听**

```javascript
const wakeUpCallback = (result) => console.log('wake up:', result); // {channel, data} 或 null
openinstall.addWakeUpListener(wakeUpCallback);
openinstall.removeWakeUpListener(wakeUpCallback);
```

**获取安装参数**

```javascript
// s：超时时长（秒），一般 10~15s；只在后台统计可用更长时间
openinstall.getInstall(10, (result) => {
  // {channel, data, shouldRetry, message} 或 null；超时/网络失败 shouldRetry=true
});
```

**渠道统计**

```javascript
openinstall.reportRegister();                                       // 注册事件（鸿蒙端返回 Promise，可选用）
openinstall.reportEffectPoint('effect_test', 100, { goodsId: '10086' }); // 效果点 + 明细
```

**裂变分享统计**

```javascript
openinstall.reportShare('c0011', 'QQ', (ret) => {
  console.log(ret.shouldRetry, ret.message); // 网络类失败 shouldRetry=true
});
```

## 接口说明

> [!TIP] "Platform"列表示该属性在原三方库上支持的平台。

> [!TIP] "OpenHarmony Support"列为 yes 表示 OpenHarmony平台支持 该属性；no 则表示不支持；partially 表示部分支持。使用方法跨平台一致，效果对标 iOS 或 Android 的效果。

### API

| 名称     | 类型     | 参数类型 | 返回值 | 必填    | 平台 | OpenHarmony平台支持 | 描述  |
|--------|---------|-----|-------|-------|--------|-----|-----------------|
| config | function | adEnabled: boolean, oaid?: string, gaid?: string | void | No | Android | no | 旧版配置接口（1.5.0 废除），gaid 为 Android 广告标识，鸿蒙无对应（JS 层守卫） |
| configAndroid | function | options: {adEnabled?, oaid?, macAddress?} | void | No | Android | yes | 初始化前配置；鸿蒙承接 OpInitConfig 支持的配置项（gaid/imei 等忽略） |
| configIOS | function | options | void | No | iOS | no | iOS 广告归因配置（ASA/idfa/caid），苹果生态专有 |
| serialEnabled | function | enabled: boolean | void | No | Android | no | 设备序列号开关，鸿蒙 SDK 无对应能力（JS 层守卫） |
| clipBoardEnabled | function | enabled: boolean | void | No | Android, iOS | yes | 剪贴板免填邀请码（场景还原）开关，须在 init 前调用（映射 OpInitConfig.fetchPasteData，默认开启） |
| init | function | options?: {adEnabled?, oaid?, macAddress?} | void | No | All | yes | 初始化 SDK；鸿蒙可传配置，等价于先 configAndroid 再 init |
| getInstall | function | s: number, cb: (result) => void | void | No | All | yes | 获取安装动态参数；s 为超时秒数，result 为 {channel, data, shouldRetry?, message?} 或 null |
| getInstallCanRetry | function | s: number, cb: (result) => void | void | No | Android | no | 可重试获取安装参数（不中断初始化读取匹配数据），Android 专有（JS 层守卫） |
| addWakeUpListener | function | cb: (result) => void | void | No | All | yes | 监听一键拉起参数；result 为 {channel, data} 或 null，冷启动参数在注册后重放 |
| getWakeUpAlwaysCallback | function | cb: (result) => void | void | No | Android | no | 无数据也回调的拉起监听，Android 专有（JS 层守卫） |
| removeWakeUpListener | function | cb: (result) => void | void | No | All | yes | 移除拉起监听（传入 addWakeUpListener 注册的同一回调） |
| reportRegister | function | / | void（鸿蒙端额外返回 Promise） | No | All | yes | 上报注册事件（注册量统计）；鸿蒙端 Promise 成功 resolve / 失败 reject（携带 SDK 错误码），可选择性使用 |
| reportEffectPoint | function | effectID: string, effectValue: number, extraMap?: object | void（鸿蒙端额外返回 Promise） | No | All | yes | 上报效果点；effectID 需在 OpenInstall 控制台预建，effectValue 金额以分计，extraMap 为效果点明细 |
| reportShare | function | shareCode: string, sharePlatform: string, cb: (result) => void | void | No | All | yes | 裂变分享统计；回调参数为 {shouldRetry, message}，网络类失败 shouldRetry=true |

> 字段契约：SDK `OpData{channelCode, bindData}` → JS `{channel, data}`（bindData 序列化为字符串）；`channel` 与 `data` 均为空且无错误信息时回调 `null`；错误经 `{shouldRetry, message}` 返回（超时/网络请求失败 shouldRetry=true，其余 false）。

## 遗留问题

- Example 内置的是测试 appkey（`openinstall_test_appkey`）与测试 scheme（`openinstalltest`），真实渠道归因/拉起需替换为 OpenInstall 控制台为本应用生成的值。
- 真实归因数据依赖 OpenInstall 服务端与外网；未配置控制台前，接口返回真实错误（如 REQUEST_FAIL / TIMEOUT），属预期行为。

## 其他

无

## 目录结构

````
/rntpc_openinstall-react-native  # 项目根目录
├── harmony                        # 鸿蒙适配代码
│    └─ openinstall_react_native.har     # har 包
│    └─ openinstall_react_native         # 鸿蒙适配核心代码
│          └─ index.ets                  # 鸿蒙适配代码入口（导出 Package / OpeninstallBridge）
│          └─ src/main/ets
│              └─ OpeninstallTurboModule.ets         # TurboModule 实现（@openinstall/sdk 桥接）
│              └─ OpeninstallBridge.ets              # preInit / Want 生命周期桥接
│              └─ OpeninstallReactNativeTurboModulesFactory.ets
│          └─ src/main/cpp
│              └─ OpeninstallReactNativePackage.h    # C++ Package
├── src                            # RN 代码
│    └─ index.ts                   # 入口文件
│    └─ specs/v1/NativeOpeninstallModule.ts  # TurboModule Spec
├── example                        # 示例工程（含鸿蒙 harmony 工程）
├── README.md                      # 中文安装使用方法
└── CHANGELOG.md
````

## 贡献代码

使用过程中发现任何问题都可以提交 [Issue](https://gitcode.com/CPF-RN/rntpc_openinstall-react-native/issues)，当然，也非常欢迎提交 [PR](https://gitcode.com/CPF-RN/rntpc_openinstall-react-native/pulls) 。

## 开源协议

本项目基于 [ISC](https://github.com/OpenInstall/openinstall-react-native/blob/master/LICENSE) 协议，请自由地享受和参与开源；原生底座 `@openinstall/sdk` 为 Apache-2.0。
