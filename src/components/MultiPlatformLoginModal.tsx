import { forwardRef, useImperativeHandle, useRef, useCallback, useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import Modal, { type ModalType } from '@/components/common/Modal';
import WebView, { type WebViewNavigation } from 'react-native-webview';
import { useTheme } from '@/store/theme/hook';
import { useStatusbarHeight } from '@/store/common/hook';
import { Icon } from '@/components/common/Icon';
import Text from '@/components/common/Text';
import { toast } from '@/utils/tools';
import CookieManager from '@react-native-cookies/cookies';

export interface MultiPlatformLoginModalType {
  show: (config: PlatformLoginConfig) => void;
}

interface PlatformLoginConfig {
  platformId: string;
  loginUrl: string;
  successUrlFlag: string;
  eventName: string;
  api: any;
  platformName?: string;
}

const Header = ({ title, onClose }: { title: string; onClose: () => void }) => {
  const theme = useTheme();
  const statusBarHeight = useStatusbarHeight();

  return (
    <View style={[styles.header, { height: 50 + statusBarHeight, paddingTop: statusBarHeight, backgroundColor: theme['c-content-background'] }]}>
      <TouchableOpacity onPress={onClose} style={styles.backButton}>
        <Icon name="chevron-left" size={24} color={theme['c-font']} />
      </TouchableOpacity>
      <Text size={18}>{title}</Text>
      <View style={styles.backButton} />
    </View>
  );
};

export default forwardRef<MultiPlatformLoginModalType, {}>((props, ref) => {
  const modalRef = useRef<ModalType>(null);
  const webViewRef = useRef<WebView>(null);
  const loggedInRef = useRef(false);
  const isCheckingRef = useRef(false);
  const configRef = useRef<PlatformLoginConfig | null>(null);
  const theme = useTheme();
  const [title, setTitle] = useState('网页登录');

  useImperativeHandle(ref, () => ({
    show(config: PlatformLoginConfig) {
      configRef.current = config;
      loggedInRef.current = false;
      isCheckingRef.current = false;
      setTitle(`${config.platformName || config.platformId} 登录`);
      modalRef.current?.setVisible(true);
    },
  }));

  const handleClose = useCallback(() => {
    modalRef.current?.setVisible(false);
  }, []);

  const handleNavigationStateChange = async (navState: WebViewNavigation) => {
    const config = configRef.current;
    if (!config) return;

    console.log(`Web登录[${config.platformId}]: 页面导航状态变化:`, navState.url);
    const url = navState.url;
    const isLoggedIn = url.includes(config.successUrlFlag) && !url.includes('/login') && !url.includes('/m/login');

    if (isLoggedIn) {
      try {
        const cookies = await CookieManager.get(navState.url, true);
        const cookieString = Object.values(cookies)
          .map((c: any) => `${c.name}=${c.value}`)
          .join('; ');
        handleMessage({ nativeEvent: { data: cookieString } });
      } catch (err) {
        console.error(`Web登录[${config.platformId}]: CookieManager提取失败`, err);
        webViewRef.current?.injectJavaScript('window.ReactNativeWebView.postMessage(document.cookie);');
      }
    }
  };

  const handleMessage = async (event: any) => {
    const config = configRef.current;
    if (!config) return;

    if (loggedInRef.current || isCheckingRef.current) return;

    const cookie = event.nativeEvent.data;
    if (!cookie || cookie.length < 10) return;

    isCheckingRef.current = true;
    try {
      await config.api.getUid(cookie);
      loggedInRef.current = true;
      global.app_event.emit(config.eventName, cookie);
      toast(`登录成功，已自动获取 Cookie！`);
      handleClose();
    } catch (error) {
      console.log(`Web登录[${config.platformId}]: Cookie验证失败:`, (error as Error).message);
    } finally {
      isCheckingRef.current = false;
    }
  };

  const injectedJavaScript = `true;`;

  return (
    <Modal ref={modalRef} onHide={() => {}} statusBarPadding={false} bgHide={false}>
      <View style={[styles.container, { backgroundColor: theme['c-content-background'] }]}>
        <Header title={title} onClose={handleClose} />
        <WebView
          ref={webViewRef}
          source={{ uri: configRef.current?.loginUrl || 'about:blank' }}
          onMessage={handleMessage}
          injectedJavaScript={injectedJavaScript}
          onNavigationStateChange={handleNavigationStateChange}
          userAgent="Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
        />
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 5,
    width: 40,
  },
});