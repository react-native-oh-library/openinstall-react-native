/**
 * This source code is licensed under the MIT license found in the
 * LICENSE-MIT file in the root directory of this source tree.
 */

import { AbilityConstant, Want } from '@kit.AbilityKit';
import { RNAbility } from '@rnoh/react-native-openharmony';
import { OpeninstallBridge } from '@react-native-ohos/openinstall-react-native';

export default class EntryAbility extends RNAbility {
  getPagePath() {
    return 'pages/Index';
  }

  onCreate(want?: Want, launchParam?: AbilityConstant.LaunchParam): void {
    // 冷启动 Want 交给插件（注册拉起监听时消费，只消费一次）
    if (want) {
      OpeninstallBridge.onAbilityCreate(want);
    }
    super.onCreate(want);
  }

  onNewWant(want: Want, launchParam?: AbilityConstant.LaunchParam): void {
    // 热启动 / 链接拉起（launchType: singleton 时必走此处）
    OpeninstallBridge.onAbilityNewWant(want);
    super.onNewWant(want, launchParam);
  }
}
