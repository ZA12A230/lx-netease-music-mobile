import { useEffect, useRef, useState } from 'react';
import MultiPlatformLoginModal, { type MultiPlatformLoginModalType } from './MultiPlatformLoginModal';

export default () => {
  const modalRef = useRef<MultiPlatformLoginModalType>(null);
  const [visible, setVisible] = useState(false);
  const visibleRef = useRef(false);
  const pendingConfigRef = useRef<any>(null);

  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  useEffect(() => {
    const handleShow = (config: any) => {
      if (visibleRef.current) {
        modalRef.current?.show(config);
      } else {
        pendingConfigRef.current = config;
        setVisible(true);
      }
    };

    global.app_event.on('showMultiPlatformLogin', handleShow);
    return () => {
      global.app_event.off('showMultiPlatformLogin', handleShow);
    };
  }, []);

  // 当组件挂载并 visible 变为 true 时，显示之前缓存的配置
  useEffect(() => {
    if (visible && pendingConfigRef.current && modalRef.current) {
      modalRef.current.show(pendingConfigRef.current);
      pendingConfigRef.current = null;
    }
  }, [visible]);

  return visible ? <MultiPlatformLoginModal ref={modalRef} /> : null;
};