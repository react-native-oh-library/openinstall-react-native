/**
 * openinstall-react-native 鸿蒙适配 Example
 *
 * 覆盖核心 API：configAndroid → init → addWakeUpListener / removeWakeUpListener →
 * getInstall → reportRegister → reportEffectPoint（含明细 extraMap）→ reportShare。
 * 所有操作均调用插件真实实现，界面展示真实返回值 / 状态变化 / 错误信息。
 *
 * 注意：真实渠道归因数据依赖 OpenInstall 控制台配置的 appkey/scheme 与外网；
 * 本 Example 使用测试 appkey（module.json5），未配置前接口返回真实错误码
 * （如 REQUEST_FAIL / NOT_INIT），同样是真实行为。
 */

import React, {useCallback, useState} from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import openinstall from '@react-native-ohos/openinstall-react-native';

// Hermes 无 Intl：手动拼接时间戳（避免 toLocaleString）
function stamp(): string {
  const d = new Date();
  const p = (n: number) => (n < 10 ? '0' + n : '' + n);
  return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
}

type LogItem = {time: string; text: string; color: string};

type SectionProps = {title: string; children?: React.ReactNode};

const Section: React.FC<SectionProps> = ({title, children}) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
);

const Button: React.FC<{title: string; onPress: () => void; danger?: boolean}> = ({
  title,
  onPress,
  danger,
}) => (
  <TouchableOpacity
    style={[styles.button, danger ? styles.buttonDanger : null]}
    onPress={onPress}
    activeOpacity={0.6}>
    <Text style={styles.buttonText}>{title}</Text>
  </TouchableOpacity>
);

const Toggle: React.FC<{label: string; value: boolean; onChange: (v: boolean) => void}> = ({
  label,
  value,
  onChange,
}) => (
  <TouchableOpacity style={styles.toggleRow} onPress={() => onChange(!value)} activeOpacity={0.6}>
    <Text style={styles.label}>{label}</Text>
    <Text style={[styles.toggleValue, value ? styles.on : styles.off]}>
      {value ? '开' : '关'}
    </Text>
  </TouchableOpacity>
);

export default function App(): JSX.Element {
  const [logs, setLogs] = useState<LogItem[]>([
    {time: stamp(), text: '平台：' + Platform.OS + '（SDK 待初始化）', color: '#555'},
  ]);
  const [initialized, setInitialized] = useState(false);

  // 初始化配置项
  const [adEnabled, setAdEnabled] = useState(false);
  const [clipBoard, setClipBoard] = useState(true);
  const [oaid, setOaid] = useState('');
  const [macAddress, setMacAddress] = useState('');

  // 拉起
  const [wakeupListening, setWakeupListening] = useState(false);
  const [wakeupData, setWakeupData] = useState<string>('（尚未收到拉起事件）');

  // 安装参数
  const [installTimeout, setInstallTimeout] = useState('10');
  const [installResult, setInstallResult] = useState<string>('（未获取）');

  // 效果点 / 分享
  const [effectID, setEffectID] = useState('effect_test');
  const [effectValue, setEffectValue] = useState('100');
  const [extraMapText, setExtraMapText] = useState('{"goodsId": "10086", "userType": "vip"}');
  const [shareCode, setShareCode] = useState('c0011');
  const [sharePlatform, setSharePlatform] = useState('QQ');

  const log = useCallback((text: string, color = '#333') => {
    setLogs(prev => [{time: stamp(), text, color}, ...prev].slice(0, 200));
  }, []);

  const onWakeup = useCallback((result: {channel: string | null; data: string | null} | null) => {
    if (result === null) {
      setWakeupData('null（本次启动无拉起参数）');
      log('addWakeUpListener 回调：null（channel/data 均为空）', '#888');
    } else {
      setWakeupData(JSON.stringify(result));
      log('addWakeUpListener 回调：' + JSON.stringify(result), '#0a7');
    }
  }, [log]);

  const doInit = useCallback(() => {
    const options: Record<string, unknown> = {};
    if (adEnabled) {
      options.adEnabled = true;
    }
    if (oaid.length > 0) {
      options.oaid = oaid;
    }
    if (macAddress.length > 0) {
      options.macAddress = macAddress;
    }
    openinstall.clipBoardEnabled(clipBoard);
    if (Object.keys(options).length > 0) {
      openinstall.configAndroid(options as {adEnabled?: boolean; oaid?: string; macAddress?: string});
    }
    openinstall.init();
    setInitialized(true);
    log(
      'init() 已调用（adEnabled=' +
        adEnabled +
        ', clipBoard=' +
        clipBoard +
        ', oaid=' +
        (oaid.length > 0 ? oaid : '-') +
        ', macAddress=' +
        (macAddress.length > 0 ? macAddress : '-') +
        '）',
    );
  }, [adEnabled, clipBoard, oaid, macAddress, log]);

  const doGetInstall = useCallback(() => {
    const s = Number(installTimeout) > 0 ? Number(installTimeout) : 10;
    log('getInstall(' + s + 's) 请求中…', '#888');
    openinstall.getInstall(s, result => {
      if (result === null) {
        setInstallResult('null（自然安装，无渠道参数）');
        log('getInstall 回调：null（channel 与 data 均为空）', '#888');
      } else {
        setInstallResult(JSON.stringify(result));
        log('getInstall 回调：' + JSON.stringify(result), result.message ? '#c60' : '#0a7');
      }
    });
  }, [installTimeout, log]);

  const doReportRegister = useCallback(() => {
    log('reportRegister() 请求中…', '#888');
    openinstall
      .reportRegister()
      .then(() => log('reportRegister 成功（Promise resolve）', '#0a7'))
      .catch((e: unknown) => log('reportRegister 失败：' + String(e), '#c33'));
  }, [log]);

  const doReportEffectPoint = useCallback(
    (withExtra: boolean) => {
      const id = effectID.trim();
      const v = Number(effectValue);
      let extra: Record<string, string> | undefined;
      if (withExtra) {
        try {
          const parsed = JSON.parse(extraMapText) as Record<string, unknown>;
          extra = {};
          Object.keys(parsed).forEach(k => {
            extra![k] = String(parsed[k]);
          });
        } catch (e) {
          log('extraMap 不是合法 JSON：' + String(e), '#c33');
          return;
        }
      }
      log(
        'reportEffectPoint(' + id + ', ' + v + (withExtra ? ', extraMap=' + JSON.stringify(extra) : '') + ') 请求中…',
        '#888',
      );
      openinstall
        .reportEffectPoint(id, v, extra)
        .then(() => log('reportEffectPoint 成功（Promise resolve）', '#0a7'))
        .catch((e: unknown) => log('reportEffectPoint 失败：' + String(e), '#c33'));
    },
    [effectID, effectValue, extraMapText, log],
  );

  const doReportShare = useCallback(() => {
    log('reportShare(' + shareCode + ', ' + sharePlatform + ') 请求中…', '#888');
    openinstall.reportShare(shareCode, sharePlatform, ret => {
      log('reportShare 回调：' + JSON.stringify(ret), ret.shouldRetry ? '#c60' : '#0a7');
    });
  }, [shareCode, sharePlatform, log]);

  const doAddWakeupListener = useCallback(() => {
    openinstall.addWakeUpListener(onWakeup);
    setWakeupListening(true);
    log('addWakeUpListener 已注册（DeviceEventEmitter: OpeninstallWakeupCallBack）');
  }, [onWakeup, log]);

  const doRemoveWakeupListener = useCallback(() => {
    openinstall.removeWakeUpListener(onWakeup);
    setWakeupListening(false);
    log('removeWakeUpListener 已移除');
  }, [onWakeup, log]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>openinstall 鸿蒙适配 Demo</Text>
        <Text style={styles.headerSub}>
          {Platform.OS} · SDK {initialized ? '已初始化' : '未初始化'}
        </Text>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <Section title="1. 初始化（configAndroid + init）">
          <Toggle label="adEnabled（广告渠道归因）" value={adEnabled} onChange={setAdEnabled} />
          <Toggle label="clipBoardEnabled（剪贴板免填邀请码）" value={clipBoard} onChange={setClipBoard} />
          <TextInput style={styles.input} value={oaid} onChangeText={setOaid} placeholder="oaid（可选）" placeholderTextColor="#999" />
          <TextInput style={styles.input} value={macAddress} onChangeText={setMacAddress} placeholder="macAddress（可选）" placeholderTextColor="#999" />
          <Button title="配置并初始化 init()" onPress={doInit} />
          <Text style={styles.hint}>
            appkey/scheme 配置于 module.json5（metadata com.openinstall.APP_KEY + skills），请替换为
            OpenInstall 控制台为本应用生成的值。
          </Text>
        </Section>

        <Section title="2. 一键拉起（scheme / App Linking）">
          <View style={styles.row}>
            <Button title={wakeupListening ? '已注册监听' : '注册监听 addWakeUpListener'} onPress={doAddWakeupListener} />
            <Button title="移除监听" onPress={doRemoveWakeupListener} danger={true} />
          </View>
          <Text style={styles.result}>最近拉起数据：{wakeupData}</Text>
          <Text style={styles.hint}>
            用浏览器/hdc 打开 openinstalltest://test?data=xxx 可触发拉起（scheme 需与控制台一致）。
            冷启动参数在注册监听后自动重放。
          </Text>
        </Section>

        <Section title="3. App 传参安装（getInstall）">
          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.smallInput]}
              value={installTimeout}
              onChangeText={setInstallTimeout}
              placeholder="超时(秒)"
              placeholderTextColor="#999"
            />
            <Button title="获取安装参数" onPress={doGetInstall} />
          </View>
          <Text style={styles.result}>安装参数：{installResult}</Text>
          <Text style={styles.hint}>channel 与 data 均为空且无错误时回调 null；超时/网络失败返回 shouldRetry + message。</Text>
        </Section>

        <Section title="4. 渠道统计">
          <Button title="上报注册事件 reportRegister()" onPress={doReportRegister} />
          <TextInput style={styles.input} value={effectID} onChangeText={setEffectID} placeholder="效果点ID" placeholderTextColor="#999" />
          <TextInput style={styles.input} value={effectValue} onChangeText={setEffectValue} placeholder="效果点值" placeholderTextColor="#999" />
          <TextInput
            style={[styles.input, styles.multiline]}
            value={extraMapText}
            onChangeText={setExtraMapText}
            placeholder="效果点明细 JSON"
            placeholderTextColor="#999"
            multiline={true}
          />
          <View style={styles.row}>
            <Button title="效果点上报" onPress={() => doReportEffectPoint(false)} />
            <Button title="效果点明细上报" onPress={() => doReportEffectPoint(true)} />
          </View>
        </Section>

        <Section title="5. 裂变分享统计（reportShare）">
          <View style={styles.row}>
            <TextInput style={[styles.input, styles.smallInput]} value={shareCode} onChangeText={setShareCode} placeholder="分享ID" placeholderTextColor="#999" />
            <TextInput style={[styles.input, styles.smallInput]} value={sharePlatform} onChangeText={setSharePlatform} placeholder="分享平台" placeholderTextColor="#999" />
          </View>
          <Button title="上报分享 reportShare()" onPress={doReportShare} />
        </Section>

        <Section title="6. 平台差异（harmony 不支持的能力）">
          <Text style={styles.unsupported}>· getInstallCanRetry / serialEnabled / getWakeUpAlwaysCallback：Android 专有，鸿蒙 SDK 无对应（JS 层已守卫，本平台不触发）</Text>
          <Text style={styles.unsupported}>· configIOS（ASA/idfa/caid）：苹果广告生态专有，鸿蒙不适用</Text>
          <Text style={styles.unsupported}>· 旧版 config(adEnabled, oaid, gaid)：gaid 为 Android 广告标识，鸿蒙不支持</Text>
        </Section>

        <Section title="运行日志（真实返回 / 状态 / 错误）">
          <View>
            {logs.map((item, i) => (
              <Text key={i} style={[styles.logLine, {color: item.color}]}>
                [{item.time}] {item.text}
              </Text>
            ))}
          </View>
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#f5f6f8'},
  header: {
    backgroundColor: '#2f54eb',
    paddingTop: 44,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  headerTitle: {color: '#fff', fontSize: 18, fontWeight: 'bold'},
  headerSub: {color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 4},
  body: {flex: 1},
  bodyContent: {padding: 12, paddingBottom: 40},
  section: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  sectionTitle: {fontSize: 15, fontWeight: 'bold', color: '#222', marginBottom: 10},
  row: {flexDirection: 'row', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap'},
  button: {
    backgroundColor: '#2f54eb',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginVertical: 4,
    marginRight: 8,
  },
  buttonDanger: {backgroundColor: '#e15b64'},
  buttonText: {color: '#fff', fontSize: 13},
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  label: {fontSize: 13, color: '#333'},
  toggleValue: {fontSize: 13, fontWeight: 'bold'},
  on: {color: '#0a7'},
  off: {color: '#999'},
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    color: '#333',
    marginVertical: 4,
    flex: 1,
  },
  smallInput: {maxWidth: 140},
  multiline: {minHeight: 54, textAlignVertical: 'top'},
  result: {fontSize: 13, color: '#0a7', marginTop: 6, fontWeight: 'bold'},
  hint: {fontSize: 11, color: '#999', marginTop: 6, lineHeight: 16},
  unsupported: {fontSize: 12, color: '#c60', lineHeight: 18},
  logLine: {fontSize: 11, lineHeight: 17},
});
