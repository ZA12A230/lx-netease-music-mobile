import { useEffect } from 'react';
import { toast } from '@/utils/tools';
import { createList } from '@/core/list';
import musicSdk from '@/utils/musicSdk';

interface ShareCodePlaylist {
  name: string
  songs: Array<{
    name: string
    singer: string
    source: string
    songId: string | number
  }>
  timestamp: number
}

/**
 * 歌单分享码导入管理器
 * 监听 importShareCode 事件，搜索歌曲并创建歌单
 */
export default () => {
  useEffect(() => {
    const handleImport = async (playlist: ShareCodePlaylist) => {
      const { name, songs } = playlist;
      if (!songs || songs.length === 0) {
        toast('分享码中没有歌曲数据');
        return;
      }

      toast(`正在导入歌单「${name}」，共 ${songs.length} 首歌曲...`);

      const importedMusics: LX.Music.MusicInfo[] = [];
      let foundCount = 0;
      let notFoundCount = 0;

      for (let i = 0; i < songs.length; i++) {
        const song = songs[i];
        const source = song.source as LX.Source;
        const sdk = musicSdk[source];

        if (!sdk?.musicSearch) {
          notFoundCount++;
          console.warn(`导入歌单: 平台 ${song.source} 不支持搜索`);
          continue;
        }

        try {
          const query = `${song.name} ${song.singer}`;
          const result = await sdk.musicSearch.search(query, 1, 5, 0, { enableSerpApi: false });

          if (!result?.list?.length) {
            notFoundCount++;
            continue;
          }

          // 尝试精确匹配
          const bestMatch = result.list.find((item: any) => {
            const nameMatch = item.name?.toLowerCase().includes(song.name.toLowerCase()) ||
              song.name.toLowerCase().includes(item.name?.toLowerCase());
            const singerMatch = item.singer?.toLowerCase().includes(song.singer.toLowerCase()) ||
              song.singer.toLowerCase().includes(item.singer?.toLowerCase());
            return nameMatch && singerMatch;
          }) || result.list[0];

          if (bestMatch) {
            importedMusics.push(bestMatch);
            foundCount++;
          } else {
            notFoundCount++;
          }
        } catch (e) {
          notFoundCount++;
          console.warn(`导入歌单: 搜索「${song.name} - ${song.singer}」失败`, e);
        }
      }

      if (importedMusics.length === 0) {
        toast('未能找到任何匹配的歌曲，请检查分享码是否正确');
        return;
      }

      // 创建用户列表
      try {
        await createList({
          name: `${name} (导入)`,
          list: importedMusics,
        });
        toast(`导入完成！成功匹配 ${foundCount} 首，未找到 ${notFoundCount} 首`);
      } catch (e: any) {
        toast(`创建歌单失败: ${e.message}`);
      }
    };

    global.app_event.on('importShareCode', handleImport);
    return () => {
      global.app_event.off('importShareCode', handleImport);
    };
  }, []);

  return null;
};