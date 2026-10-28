/**
 * RNPackage 注册入口：autolinking 经 ohos/package.json 的
 * harmony.autolinking.etsPackageClassName = 'OpeninstallReactNativePackage'
 * 消费本文件 default 导出的 Package。
 */

import { RNOHPackage } from '@rnoh/react-native-openharmony/ets';
import { UITurboModule, UITurboModuleContext } from '@rnoh/react-native-openharmony/ts';
import { TM } from './generated/ts';
import { OpeninstallTurboModule } from './OpeninstallTurboModule';

export class OpeninstallReactNativePackage extends RNOHPackage {
  getUITurboModuleFactoryByNameMap(): Map<string, (ctx: UITurboModuleContext) => UITurboModule | null> {
    const map = new Map<string, (ctx: UITurboModuleContext) => UITurboModule | null>();
    map.set(TM.OpeninstallModule.NAME, (ctx: UITurboModuleContext) => new OpeninstallTurboModule(ctx));
    return map;
  }

  override async createEagerUITurboModuleByNameMap(ctx: UITurboModuleContext): Promise<Map<string, UITurboModule>> {
    const module = new OpeninstallTurboModule(ctx);
    return new Map<string, UITurboModule>().set(TM.OpeninstallModule.NAME, module);
  }
}
