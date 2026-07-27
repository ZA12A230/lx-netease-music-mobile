import { useEffect, useRef } from 'react';
import { tryRecoverPlayer, recordPlayerError, classifyError, clearErrorHistory } from '@/utils/playerRecovery';
import playerState from '@/store/player/state';

/**
 * 播放器崩溃自动恢复管理器
 * 监听 playerError 事件，自动尝试恢复播放
 */
export default () => {
  const recoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handlePlayerError = () => {
      const musicInfo = playerState.playMusicInfo.musicInfo;
      if (!musicInfo) return;

      // 记录错误
      const errorType = classifyError({ message: '播放器错误' });
      recordPlayerError(errorType, '播放器播放错误');

      // 清除之前的恢复定时器
      if (recoveryTimerRef.current) {
        clearTimeout(recoveryTimerRef.current);
      }

      // 延迟3秒后尝试恢复（给播放器一些时间处理）
      recoveryTimerRef.current = setTimeout(() => {
        console.log('[PlayerRecoveryManager] 尝试自动恢复播放...');
        tryRecoverPlayer().then((recovered) => {
          if (recovered) {
            console.log('[PlayerRecoveryManager] 播放器已自动恢复');
          } else {
            console.log('[PlayerRecoveryManager] 恢复失败，需要用户手动操作');
          }
        });
      }, 3000);
    };

    const handleMusicToggled = () => {
      // 音乐切换成功，清除错误历史
      clearErrorHistory();
    };

    global.app_event.on('playerError', handlePlayerError);
    global.app_event.on('musicToggled', handleMusicToggled);

    return () => {
      global.app_event.off('playerError', handlePlayerError);
      global.app_event.off('musicToggled', handleMusicToggled);
      if (recoveryTimerRef.current) {
        clearTimeout(recoveryTimerRef.current);
      }
    };
  }, []);

  return null;
};