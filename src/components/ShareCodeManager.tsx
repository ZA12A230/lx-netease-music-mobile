import { useEffect, useRef, useState } from 'react';
import ShareCodeModal, { type ShareCodeModalType } from './ShareCodeModal';

export default () => {
  const modalRef = useRef<ShareCodeModalType>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleShow = (playlist: any) => {
      if (visible) {
        modalRef.current?.show(playlist);
      } else {
        setVisible(true);
        requestAnimationFrame(() => {
          modalRef.current?.show(playlist);
        });
      }
    };

    global.app_event.on('showShareCode', handleShow);
    return () => {
      global.app_event.off('showShareCode', handleShow);
    };
  }, [visible]);

  return visible ? <ShareCodeModal ref={modalRef} /> : null;
};