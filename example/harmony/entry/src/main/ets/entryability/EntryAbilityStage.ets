/**
 * OpenInstall SDK 预初始化（宿主接入要求：AbilityStage.onCreate 调 preInit）。
 */

import { AbilityStage } from '@kit.AbilityKit';
import { OpeninstallBridge } from '@react-native-ohos/openinstall-react-native';

export default class EntryAbilityStage extends AbilityStage {
  onCreate(): void {
    OpeninstallBridge.preInit(this.context);
  }
}
