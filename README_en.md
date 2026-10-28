> Document Template: v0.4.2

<p align="center">
  <h1 align="center"> <code>openinstall-react-native</code> </h1>
</p>

This project is based on [openinstall-react-native](https://github.com/OpenInstall/openinstall-react-native).

The version correspondence details are as follows:

| Name | Version(Npm Address) | Release Information | Supported RN Version | Supported Autolink | Compile API Version | Community Baseline Version | Source code address |
| --------------| -------------- | ------------------------------ | ------------- | ------------- |------------------------ | ------------ | ------------- | 
| @react-native-ohos/openinstall-react-native | [~ 2.0.0](https://www.npmjs.com/package/@react-native-ohos/openinstall-react-native)    | [Gitcode Releases](https://gitcode.com/CPF-RN/rntpc_openinstall-react-native/releases) | 0.84.* | Yes | API12+ | 2.0.0 | [master](https://gitcode.com/CPF-RN/rntpc_openinstall-react-native) |

## Introduction

OpenInstall plugin for React Native.<br/>
OpenInstall provides mobile attribution capabilities such as install-with-parameters (invitation codes auto-fill), one-click wake-up (scheme / App Linking), channel statistics, effect-point statistics, and fission share statistics.<br/>
Developers can track install sources and restore wake-up parameters without manually assembling channel parameters in the project.

## Installation

Go to the project directory and execute the following instruction:

**npm**

```bash
npm install @react-native-ohos/openinstall-react-native
```

**yarn**

```bash
yarn add @react-native-ohos/openinstall-react-native
```

## Link

|                                      | Supported Autolink | Supported RN Version |
|--------------------------------------|--------------------|----------------------|
| ~ 2.0.0                              | Yes                | 0.84                 |

Projects using AutoLink need to be configured according to this document, AutoLink framework guide: https://gitcode.com/CPF-RN/ohos_react_native/blob/master/docs/zh-cn/Autolinking.md

If the version you are using supports Autolink and the project has integrated Autolink, you can skip the ManualLink configuration.

<details>
  <summary>ManualLink: This step provides guidance for manually configuring native dependencies.</summary>

Open the `harmony` directory of the OpenHarmony project in DevEco Studio.

### 1. Overrides RN SDK

To ensure the project relies on the same version of the RN SDK, you need to add an `overrides` field in the project's root `oh-package.json5` file, specifying the RN SDK version to be used. The replacement version can be a specific version number, a semver range, or a locally available HAR package or source directory.

For more information about the purpose of this field, please refer to the [official documentation](https://developer.huawei.com/consumer/en/doc/harmonyos-guides-V5/ide-oh-package-json5-V5#en-us_topic_0000001792256137_overrides).

```json
{
  "overrides": {
    "@rnoh/react-native-openharmony": "^0.72.38" // ohpm version
    // "@rnoh/react-native-openharmony" : "./react_native_openharmony.har" // a locally available HAR package
    // "@rnoh/react-native-openharmony" : "./react_native_openharmony" // source code directory
  }
}
```

### 2. Introducing Native Code

Currently, two methods are available:

- Use the HAR file.
- Directly link to the source code.

Method 1 (recommended): Use the HAR file.

> [!TIP] The HAR file is stored in the `harmony` directory in the installation path of the third-party library; the native dependency `@openinstall/sdk` (OHPM) is installed automatically together with the HAR file.

Open `entry/oh-package.json5` file and add the following dependencies:

```json
"dependencies": {
    "@react-native-ohos/openinstall-react-native": "file:../../node_modules/@react-native-ohos/openinstall-react-native/harmony/openinstall_react_native.har"
  }
```

Click the `sync` button in the upper right corner.

Alternatively, run the following instruction on the terminal:

```bash
cd entry
ohpm install
```

Method 2: Directly link to the source code.

> [!TIP] For details, see [Directly Linking Source Code](https://gitcode.com/CPF-RN/usage-docs/blob/master/en/link-source-code.md).

### 3. Configuring CMakeLists and Introducing OpeninstallReactNativePackage

Open `entry/src/main/cpp/CMakeLists.txt` and add the following code:

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

Open `entry/src/main/cpp/PackageProvider.cpp` and add the following code:

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

### 4. Introducing OpeninstallReactNativePackage to ArkTS

Open `entry/src/main/ets/RNPackagesFactory.ets` and add the following code:

```diff
+ import { OpeninstallReactNativePackage } from '@react-native-ohos/openinstall-react-native/ts';

  export function createRNPackages(ctx: RNPackageContext): RNPackage[] {
    return [
+     new OpeninstallReactNativePackage(ctx),
    ];
  }
```

</details>

## Running

Click the `sync` button in the upper right corner.

Alternatively, run the following instruction on the terminal:

```bash
cd entry
ohpm install
```

Then build and run the code.

## Constraints

### Compatibility

This document is verified based on the following versions:

1.RNOH: 0.84.2; SDK: HarmonyOS 6.0.0 Release SDK; IDE: DevEco Studio 6.0.0.878; ROM:6.0.0.130;

### Permission Requirements

- This library requires the following permissions (all of them are system-granted normal-level permissions).

  Include applicable permissions in the `entry/src/main/module.json5` file within the entry directory.

```json
requestPermissions: [
  { "name": "ohos.permission.INTERNET" },
  { "name": "ohos.permission.GET_WIFI_INFO" },
  { "name": "ohos.permission.GET_BUNDLE_INFO" },
  { "name": "ohos.permission.STORE_PERSISTENT_DATA" },
],
```

### API requirements (Keep existing, remove otherwise.)

> [!TIP] All versions of the current third-party libraries have implemented version isolation, supporting compilation in `API12+` projects and execution on `API12+` ROMs.

## Example

The following code shows the basic use scenario of the repository:

> [!WARNING] The name of the imported repository remains unchanged.

```javascript
import React from 'react';
import { View } from 'react-native';
import openinstall from 'openinstall-react-native';

export default class App extends React.Component {
  componentDidMount() {
    // 1. Initialization (optional config: adEnabled / oaid / macAddress; clipBoardEnabled must be called before init)
    openinstall.clipBoardEnabled(true);
    openinstall.configAndroid({ adEnabled: true, oaid: 'xxx' });
    openinstall.init();

    // 2. One-click wake-up (scheme / App Linking): the callback returns null when both channel and data are empty
    openinstall.addWakeUpListener((wakeupResult) => {
      console.log('wake up:', wakeupResult);
    });

    // 3. Install with parameters: the timeout is usually 10~15 seconds; organic installs (no channel parameters) return null
    openinstall.getInstall(10, (installResult) => {
      console.log('install:', installResult);
    });

    // 4. Channel statistics
    openinstall.reportRegister();
    openinstall.reportEffectPoint('effect_test', 100, { goodsId: '10086' });

    // 5. Fission share statistics
    openinstall.reportShare('c0011', 'QQ', (ret) => {
      console.log(ret.shouldRetry, ret.message);
    });
  }

  render() {
    return <View style={{ flex: 1 }} />;
  }
}
```

## How to Use

### Host Project Configuration (Required)

1. **appkey**: Configure the appkey generated in the OpenInstall console in the `module.metadata` field of `entry/src/main/module.json5`:

```json5
{
  "module": {
    "metadata": [
      { "name": "com.openinstall.APP_KEY", "value": "your appkey" }
    ]
  }
}
```

2. **One-click wake-up**: Configure a custom scheme or App Linking in the `skills` of the target Ability (https + associated domain + `domainVerify: true`; the domain must be published in AGC). `launchType: "singleton"` is recommended so that hot starts go through `onNewWant`.

3. **Lifecycle handover**: The host needs to hand over the Want to the plugin (see the Example):

```typescript
// AbilityStage.onCreate
import { OpeninstallBridge } from '@react-native-ohos/openinstall-react-native';

OpeninstallBridge.preInit(this.context);

// EntryAbility.onCreate / onNewWant
OpeninstallBridge.onAbilityCreate(want);
OpeninstallBridge.onAbilityNewWant(want);
```

> The plugin aligns with the semantics of the original Android implementation: wake-up data arriving before a listener is registered is cached and replayed, and Wants arriving before init are cached and processed after init; wake-up parameters are delivered via the `DeviceEventEmitter` event `OpeninstallWakeupCallBack`.

**Initialization**

```javascript
openinstall.clipBoardEnabled(true);                      // Clipboard invitation code switch (call before init)
openinstall.configAndroid({ adEnabled: true, oaid: 'xxx', macAddress: 'xxx' });
openinstall.init();                                       // openinstall.init({ adEnabled: true }) is equivalent to config followed by init
```

**Wake-up listener**

```javascript
const wakeUpCallback = (result) => console.log('wake up:', result); // {channel, data} or null
openinstall.addWakeUpListener(wakeUpCallback);
openinstall.removeWakeUpListener(wakeUpCallback);
```

**Getting install parameters**

```javascript
// s: timeout in seconds, usually 10~15s; a longer value can be used for background-only statistics
openinstall.getInstall(10, (result) => {
  // {channel, data, shouldRetry, message} or null; shouldRetry=true on timeout/network failure
});
```

**Channel statistics**

```javascript
openinstall.reportRegister();                                          // Register event (returns a Promise on HarmonyOS, optional)
openinstall.reportEffectPoint('effect_test', 100, { goodsId: '10086' }); // Effect point with details
```

**Fission share statistics**

```javascript
openinstall.reportShare('c0011', 'QQ', (ret) => {
  console.log(ret.shouldRetry, ret.message); // shouldRetry=true for network-related failures
});
```

## Available APIs

> [!TIP] The **Platform** column indicates the platform where the properties are supported in the original third-party library.

> [!TIP] If the value of **HarmonyOS Support** is **yes**, it means that the OpenHarmony platform supports this property; **no** means the opposite; **partially** means some capabilities of this property are supported. The usage method is the same on different platforms and the effect is the same as that of iOS or Android.

### API

| Name | Type | Parameter Type | Return Value | Required | Platform | OpenHarmony Platform Support | Description |
|--------|---------|-----|-------|-------|--------|-----|-----------------|
| config | function | adEnabled: boolean, oaid?: string, gaid?: string | void | No | Android | no | Legacy config API (deprecated since 1.5.0); gaid is an Android advertising identifier with no HarmonyOS equivalent (guarded in the JS layer) |
| configAndroid | function | options: {adEnabled?, oaid?, macAddress?} | void | No | Android | yes | Pre-initialization config; on HarmonyOS only the options supported by OpInitConfig take effect (gaid/imei etc. are ignored) |
| configIOS | function | options | void | No | iOS | no | iOS advertising attribution config (ASA/idfa/caid), exclusive to the Apple ecosystem |
| serialEnabled | function | enabled: boolean | void | No | Android | no | Device serial number switch; the HarmonyOS SDK has no equivalent capability (guarded in the JS layer) |
| clipBoardEnabled | function | enabled: boolean | void | No | Android, iOS | yes | Clipboard invitation code (scene restore) switch, must be called before init (maps to OpInitConfig.fetchPasteData, enabled by default) |
| init | function | options?: {adEnabled?, oaid?, macAddress?} | void | No | All | yes | Initializes the SDK; on HarmonyOS options may be passed, equivalent to calling configAndroid before init |
| getInstall | function | s: number, cb: (result) => void | void | No | All | yes | Gets the install parameters; s is the timeout in seconds, result is {channel, data, shouldRetry?, message?} or null |
| getInstallCanRetry | function | s: number, cb: (result) => void | void | No | Android | no | Gets install parameters with retry (does not interrupt initialization matching), Android only (guarded in the JS layer) |
| addWakeUpListener | function | cb: (result) => void | void | No | All | yes | Listens for one-click wake-up parameters; result is {channel, data} or null; cold-start parameters are replayed after registration |
| getWakeUpAlwaysCallback | function | cb: (result) => void | void | No | Android | no | Wake-up listener that is always called back even without data, Android only (guarded in the JS layer) |
| removeWakeUpListener | function | cb: (result) => void | void | No | All | yes | Removes the wake-up listener (pass the same callback registered with addWakeUpListener) |
| reportRegister | function | / | void (additionally returns a Promise on HarmonyOS) | No | All | yes | Reports the register event (registration count statistics); the HarmonyOS Promise resolves on success and rejects with the SDK error code on failure, optional to use |
| reportEffectPoint | function | effectID: string, effectValue: number, extraMap?: object | void (additionally returns a Promise on HarmonyOS) | No | All | yes | Reports an effect point; effectID must be created in the OpenInstall console in advance, effectValue amounts are in cents, extraMap holds the effect-point details |
| reportShare | function | shareCode: string, sharePlatform: string, cb: (result) => void | void | No | All | yes | Fission share statistics; the callback receives {shouldRetry, message}, shouldRetry=true for network-related failures |

> Field contract: SDK `OpData{channelCode, bindData}` → JS `{channel, data}` (bindData is serialized as a string); `null` is called back when both `channel` and `data` are empty and there is no error message; errors are returned via `{shouldRetry, message}` (shouldRetry=true for timeout/network request failures, false otherwise).

## Known Issues

- The Example is built with a test appkey (`openinstall_test_appkey`) and a test scheme (`openinstalltest`); real channel attribution/wake-up requires replacing them with the values generated for your app in the OpenInstall console.
- Real attribution data depends on the OpenInstall server and internet access; before the console is configured, the APIs return real errors (such as REQUEST_FAIL / TIMEOUT), which is expected behavior.

## Other

## Directory Structure

````
/rntpc_openinstall-react-native  # Project root directory
├── harmony                        # HarmonyOS adaptation code
│    └─ openinstall_react_native.har     # har package
│    └─ openinstall_react_native         # HarmonyOS adaptation core code
│          └─ index.ets                  # HarmonyOS adaptation code entry (exports Package / OpeninstallBridge)
│          └─ src/main/ets
│              └─ OpeninstallTurboModule.ets         # TurboModule implementation (bridging @openinstall/sdk)
│              └─ OpeninstallBridge.ets              # preInit / Want lifecycle bridging
│              └─ OpeninstallReactNativeTurboModulesFactory.ets
│          └─ src/main/cpp
│              └─ OpeninstallReactNativePackage.h    # C++ Package
├── src                            # React Native code
│    └─ index.ts                   # Entry file
│    └─ specs/v1/NativeOpeninstallModule.ts  # TurboModule Spec
├── example                        # Example project (including the HarmonyOS harmony project)
├── README.md                      # Chinese document
├── README_en.md                   # English document
└── CHANGELOG.md
````

## How to Contribute

If you find any problem when using openinstall-react-native, submit an [issue](https://gitcode.com/CPF-RN/rntpc_openinstall-react-native/issues) or a [PR](https://gitcode.com/CPF-RN/rntpc_openinstall-react-native/pulls).

## License

The repository is based on [ISC](https://github.com/OpenInstall/openinstall-react-native/blob/master/LICENSE); the native dependency `@openinstall/sdk` is Apache-2.0.
