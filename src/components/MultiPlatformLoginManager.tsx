import { useEffect, useRef, useState } from 'react';
import MultiPlatformLoginModal, { type MultiPlatformLoginModalType } from './MultiPlatformLoginModal';

export default () => {
  const modalRef = useRef<MultiPlatformLoginModalType>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleShow = (config: any) => {
      if (visible) {
        modalRef.current?.show(config);
      } else {
        setVisible(true);
        requestAnimationFrame(() => {
          modalRef.current?.show(config);
        });
      }
    };

    global.app_event.on('showMultiPlatformLogin', handleShow);
    return () => {
      global.app_event.off('showMultiPlatformLogin', handleShow);
    };
  }, [visible]);

  return visible ? <MultiPlatformLoginModal ref={modalRef} /> : null;
};