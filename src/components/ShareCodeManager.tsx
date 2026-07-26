import { useEffect, useRef, useState } from 'react';
import ShareCodeModal, { type ShareCodeModalType } from './ShareCodeModal';

export default () => {
  const modalRef = useRef<ShareCodeModalType>(null);
  const [visible, setVisible] = useState(false);
  const visibleRef = useRef(false);
  const pendingPlaylistRef = useRef<any>(null);

  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  useEffect(() => {
    const handleShow = (playlist: any) => {
      if (visibleRef.current) {
        modalRef.current?.show(playlist);
      } else {
        pendingPlaylistRef.current = playlist;
        setVisible(true);
      }
    };

    global.app_event.on('showShareCode', handleShow);
    return () => {
      global.app_event.off('showShareCode', handleShow);
    };
  }, []);

  // 当组件挂载并 visible 变为 true 时，显示之前缓存的歌单
  useEffect(() => {
    if (visible && pendingPlaylistRef.current && modalRef.current) {
      modalRef.current.show(pendingPlaylistRef.current);
      pendingPlaylistRef.current = null;
    }
  }, [visible]);

  return visible ? <ShareCodeModal ref={modalRef} /> : null;
};