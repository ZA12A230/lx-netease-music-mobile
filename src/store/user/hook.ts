import { useEffect, useState } from 'react'
import state from './state'

export const useWyUid = () => {
  const [uid, setUid] = useState(state.wy_uid);

  useEffect(() => {
    const handleUpdate = () => {
      setUid(state.wy_uid);
    };
    global.state_event.on('wyUidChanged', handleUpdate);
    handleUpdate();
    return () => {
      global.state_event.off('wyUidChanged', handleUpdate);
    };
  }, []);

  return uid;
}

export const useIsWyLiked = (songId: string | number) => {
  const strId = String(songId)
  const [isLiked, setIsLiked] = useState(() => state.wy_liked_song_ids.has(strId))

  useEffect(() => {
    const handleUpdate = () => {
      const newLikedStatus = state.wy_liked_song_ids.has(strId)
      setIsLiked(currentStatus => currentStatus === newLikedStatus ? currentStatus : newLikedStatus)
    }
    global.state_event.on('wyLikedListChanged', handleUpdate)
    handleUpdate()
    return () => {
      global.state_event.off('wyLikedListChanged', handleUpdate)
    }
  }, [strId]) // 依赖项数组保持不变，仅当 songId 变化时才重新设置 effect

  return isLiked
}

export const useIsWyArtistFollowed = (artistId: string | number | undefined) => { // 允许传入 undefined
  const strId = String(artistId)
  const [isFollowed, setIsFollowed] = useState(() => artistId === undefined || artistId === null ? false : state.wy_followed_artists.some(a => String(a.id) === strId))

  useEffect(() => {
    // 当 artistId 无效时，确保状态为 false
    if (artistId === undefined || artistId === null) {
      setIsFollowed(false)
      return
    }

    const handleUpdate = () => {
      const newFollowedStatus = state.wy_followed_artists.some(a => String(a.id) === strId)
      setIsFollowed(newFollowedStatus)
    }

    global.state_event.on('wyFollowedListChanged', handleUpdate)
    handleUpdate() // 首次加载或 artistId 变化时，立即检查并更新状态

    return () => {
      global.state_event.off('wyFollowedListChanged', handleUpdate)
    }
  }, [strId, artistId]) // 同时依赖 strId 和 artistId

  return isFollowed
}

export const useWyFollowedArtists = () => {
  const [list, setList] = useState(() => state.wy_followed_artists)

  useEffect(() => {
    const handleUpdate = () => {
      setList([...state.wy_followed_artists])
    }
    global.state_event.on('wyFollowedListChanged', handleUpdate)
    handleUpdate()
    return () => {
      global.state_event.off('wyFollowedListChanged', handleUpdate)
    }
  }, [])

  return list
}


export const useIsWyAlbumSubscribed = (albumId: string | number | undefined) => {
  const strId = String(albumId);
  const [isSubscribed, setIsSubscribed] = useState(() =>
    albumId === undefined || albumId === null ? false : state.wy_subscribed_albums.some(a => String(a.id) === strId),
  );

  useEffect(() => {
    if (albumId === undefined || albumId === null) {
      setIsSubscribed(false);
      return;
    }

    const handleUpdate = () => {
      const newSubscribedStatus = state.wy_subscribed_albums.some(a => String(a.id) === strId);
      setIsSubscribed(newSubscribedStatus);
    };

    global.state_event.on('wySubscribedAlbumsChanged', handleUpdate);
    handleUpdate();

    return () => {
      global.state_event.off('wySubscribedAlbumsChanged', handleUpdate);
    };
  }, [strId, albumId]);

  return isSubscribed;
};

export const useWySubscribedAlbums = () => {
  const [list, setList] = useState(() => state.wy_subscribed_albums);
  useEffect(() => {
    const handleUpdate = () => {
      setList([...state.wy_subscribed_albums]);
    };
    global.state_event.on('wySubscribedAlbumsChanged', handleUpdate);
    handleUpdate();
    return () => {
      global.state_event.off('wySubscribedAlbumsChanged', handleUpdate);
    };
  }, []);
  return list;
};

export const useIsWyPlaylistSubscribed = (playlistId: string | number | undefined) => {
  const strId = String(playlistId);
  const [isSubscribed, setIsSubscribed] = useState(() =>
    playlistId === undefined || playlistId === null ? false : state.wy_subscribed_playlists.some(p => String(p.id) === strId),
  );

  useEffect(() => {
    if (playlistId === undefined || playlistId === null) {
      setIsSubscribed(false);
      return;
    }
    const handleUpdate = () => {
      const newSubscribedStatus = state.wy_subscribed_playlists.some(p => String(p.id) === strId);
      setIsSubscribed(newSubscribedStatus);
    };
    global.state_event.on('wySubscribedPlaylistsChanged', handleUpdate);
    handleUpdate();
    return () => {
      global.state_event.off('wySubscribedPlaylistsChanged', handleUpdate);
    };
  }, [strId, playlistId]);

  return isSubscribed;
};

export const useWySubscribedPlaylists = () => {
  const [list, setList] = useState(() => state.wy_subscribed_playlists);
  useEffect(() => {
    const handleUpdate = () => {
      setList([...state.wy_subscribed_playlists]);
    };
    global.state_event.on('wySubscribedPlaylistsChanged', handleUpdate);
    handleUpdate();
    return () => {
      global.state_event.off('wySubscribedPlaylistsChanged', handleUpdate);
    };
  }, []);
  return list;
};

// ===================== QQ音乐 =====================
export const useTxUid = () => {
  const [uid, setUid] = useState(state.tx_uid);

  useEffect(() => {
    const handleUpdate = () => {
      setUid(state.tx_uid);
    };
    global.state_event.on('txUidChanged', handleUpdate);
    handleUpdate();
    return () => {
      global.state_event.off('txUidChanged', handleUpdate);
    };
  }, []);

  return uid;
}

export const useIsTxLiked = (songId: string | number) => {
  const strId = String(songId)
  const [isLiked, setIsLiked] = useState(() => state.tx_liked_song_ids.has(strId))

  useEffect(() => {
    const handleUpdate = () => {
      const newLikedStatus = state.tx_liked_song_ids.has(strId)
      setIsLiked(currentStatus => currentStatus === newLikedStatus ? currentStatus : newLikedStatus)
    }
    global.state_event.on('txLikedListChanged', handleUpdate)
    handleUpdate()
    return () => {
      global.state_event.off('txLikedListChanged', handleUpdate)
    }
  }, [strId]) // 依赖项数组保持不变，仅当 songId 变化时才重新设置 effect

  return isLiked
}

export const useIsTxArtistFollowed = (artistId: string | number | undefined) => { // 允许传入 undefined
  const strId = String(artistId)
  const [isFollowed, setIsFollowed] = useState(() => artistId === undefined || artistId === null ? false : state.tx_followed_artists.some(a => String(a.id) === strId))

  useEffect(() => {
    // 当 artistId 无效时，确保状态为 false
    if (artistId === undefined || artistId === null) {
      setIsFollowed(false)
      return
    }

    const handleUpdate = () => {
      const newFollowedStatus = state.tx_followed_artists.some(a => String(a.id) === strId)
      setIsFollowed(newFollowedStatus)
    }

    global.state_event.on('txFollowedListChanged', handleUpdate)
    handleUpdate() // 首次加载或 artistId 变化时，立即检查并更新状态

    return () => {
      global.state_event.off('txFollowedListChanged', handleUpdate)
    }
  }, [strId, artistId]) // 同时依赖 strId 和 artistId

  return isFollowed
}

export const useTxFollowedArtists = () => {
  const [list, setList] = useState(() => state.tx_followed_artists)

  useEffect(() => {
    const handleUpdate = () => {
      setList([...state.tx_followed_artists])
    }
    global.state_event.on('txFollowedListChanged', handleUpdate)
    handleUpdate()
    return () => {
      global.state_event.off('txFollowedListChanged', handleUpdate)
    }
  }, [])

  return list
}


export const useIsTxAlbumSubscribed = (albumId: string | number | undefined) => {
  const strId = String(albumId);
  const [isSubscribed, setIsSubscribed] = useState(() =>
    albumId === undefined || albumId === null ? false : state.tx_subscribed_albums.some(a => String(a.id) === strId),
  );

  useEffect(() => {
    if (albumId === undefined || albumId === null) {
      setIsSubscribed(false);
      return;
    }

    const handleUpdate = () => {
      const newSubscribedStatus = state.tx_subscribed_albums.some(a => String(a.id) === strId);
      setIsSubscribed(newSubscribedStatus);
    };

    global.state_event.on('txSubscribedAlbumsChanged', handleUpdate);
    handleUpdate();

    return () => {
      global.state_event.off('txSubscribedAlbumsChanged', handleUpdate);
    };
  }, [strId, albumId]);

  return isSubscribed;
};

export const useTxSubscribedAlbums = () => {
  const [list, setList] = useState(() => state.tx_subscribed_albums);
  useEffect(() => {
    const handleUpdate = () => {
      setList([...state.tx_subscribed_albums]);
    };
    global.state_event.on('txSubscribedAlbumsChanged', handleUpdate);
    handleUpdate();
    return () => {
      global.state_event.off('txSubscribedAlbumsChanged', handleUpdate);
    };
  }, []);
  return list;
};

export const useIsTxPlaylistSubscribed = (playlistId: string | number | undefined) => {
  const strId = String(playlistId);
  const [isSubscribed, setIsSubscribed] = useState(() =>
    playlistId === undefined || playlistId === null ? false : state.tx_subscribed_playlists.some(p => String(p.id) === strId),
  );

  useEffect(() => {
    if (playlistId === undefined || playlistId === null) {
      setIsSubscribed(false);
      return;
    }
    const handleUpdate = () => {
      const newSubscribedStatus = state.tx_subscribed_playlists.some(p => String(p.id) === strId);
      setIsSubscribed(newSubscribedStatus);
    };
    global.state_event.on('txSubscribedPlaylistsChanged', handleUpdate);
    handleUpdate();
    return () => {
      global.state_event.off('txSubscribedPlaylistsChanged', handleUpdate);
    };
  }, [strId, playlistId]);

  return isSubscribed;
};

export const useTxSubscribedPlaylists = () => {
  const [list, setList] = useState(() => state.tx_subscribed_playlists);
  useEffect(() => {
    const handleUpdate = () => {
      setList([...state.tx_subscribed_playlists]);
    };
    global.state_event.on('txSubscribedPlaylistsChanged', handleUpdate);
    handleUpdate();
    return () => {
      global.state_event.off('txSubscribedPlaylistsChanged', handleUpdate);
    };
  }, []);
  return list;
};

// ===================== 酷狗音乐 =====================
export const useKgUid = () => {
  const [uid, setUid] = useState(state.kg_uid);

  useEffect(() => {
    const handleUpdate = () => {
      setUid(state.kg_uid);
    };
    global.state_event.on('kgUidChanged', handleUpdate);
    handleUpdate();
    return () => {
      global.state_event.off('kgUidChanged', handleUpdate);
    };
  }, []);

  return uid;
}

export const useIsKgLiked = (songId: string | number) => {
  const strId = String(songId)
  const [isLiked, setIsLiked] = useState(() => state.kg_liked_song_ids.has(strId))

  useEffect(() => {
    const handleUpdate = () => {
      const newLikedStatus = state.kg_liked_song_ids.has(strId)
      setIsLiked(currentStatus => currentStatus === newLikedStatus ? currentStatus : newLikedStatus)
    }
    global.state_event.on('kgLikedListChanged', handleUpdate)
    handleUpdate()
    return () => {
      global.state_event.off('kgLikedListChanged', handleUpdate)
    }
  }, [strId]) // 依赖项数组保持不变，仅当 songId 变化时才重新设置 effect

  return isLiked
}

export const useIsKgArtistFollowed = (artistId: string | number | undefined) => { // 允许传入 undefined
  const strId = String(artistId)
  const [isFollowed, setIsFollowed] = useState(() => artistId === undefined || artistId === null ? false : state.kg_followed_artists.some(a => String(a.id) === strId))

  useEffect(() => {
    // 当 artistId 无效时，确保状态为 false
    if (artistId === undefined || artistId === null) {
      setIsFollowed(false)
      return
    }

    const handleUpdate = () => {
      const newFollowedStatus = state.kg_followed_artists.some(a => String(a.id) === strId)
      setIsFollowed(newFollowedStatus)
    }

    global.state_event.on('kgFollowedListChanged', handleUpdate)
    handleUpdate() // 首次加载或 artistId 变化时，立即检查并更新状态

    return () => {
      global.state_event.off('kgFollowedListChanged', handleUpdate)
    }
  }, [strId, artistId]) // 同时依赖 strId 和 artistId

  return isFollowed
}

export const useKgFollowedArtists = () => {
  const [list, setList] = useState(() => state.kg_followed_artists)

  useEffect(() => {
    const handleUpdate = () => {
      setList([...state.kg_followed_artists])
    }
    global.state_event.on('kgFollowedListChanged', handleUpdate)
    handleUpdate()
    return () => {
      global.state_event.off('kgFollowedListChanged', handleUpdate)
    }
  }, [])

  return list
}


export const useIsKgAlbumSubscribed = (albumId: string | number | undefined) => {
  const strId = String(albumId);
  const [isSubscribed, setIsSubscribed] = useState(() =>
    albumId === undefined || albumId === null ? false : state.kg_subscribed_albums.some(a => String(a.id) === strId),
  );

  useEffect(() => {
    if (albumId === undefined || albumId === null) {
      setIsSubscribed(false);
      return;
    }

    const handleUpdate = () => {
      const newSubscribedStatus = state.kg_subscribed_albums.some(a => String(a.id) === strId);
      setIsSubscribed(newSubscribedStatus);
    };

    global.state_event.on('kgSubscribedAlbumsChanged', handleUpdate);
    handleUpdate();

    return () => {
      global.state_event.off('kgSubscribedAlbumsChanged', handleUpdate);
    };
  }, [strId, albumId]);

  return isSubscribed;
};

export const useKgSubscribedAlbums = () => {
  const [list, setList] = useState(() => state.kg_subscribed_albums);
  useEffect(() => {
    const handleUpdate = () => {
      setList([...state.kg_subscribed_albums]);
    };
    global.state_event.on('kgSubscribedAlbumsChanged', handleUpdate);
    handleUpdate();
    return () => {
      global.state_event.off('kgSubscribedAlbumsChanged', handleUpdate);
    };
  }, []);
  return list;
};

export const useIsKgPlaylistSubscribed = (playlistId: string | number | undefined) => {
  const strId = String(playlistId);
  const [isSubscribed, setIsSubscribed] = useState(() =>
    playlistId === undefined || playlistId === null ? false : state.kg_subscribed_playlists.some(p => String(p.id) === strId),
  );

  useEffect(() => {
    if (playlistId === undefined || playlistId === null) {
      setIsSubscribed(false);
      return;
    }
    const handleUpdate = () => {
      const newSubscribedStatus = state.kg_subscribed_playlists.some(p => String(p.id) === strId);
      setIsSubscribed(newSubscribedStatus);
    };
    global.state_event.on('kgSubscribedPlaylistsChanged', handleUpdate);
    handleUpdate();
    return () => {
      global.state_event.off('kgSubscribedPlaylistsChanged', handleUpdate);
    };
  }, [strId, playlistId]);

  return isSubscribed;
};

export const useKgSubscribedPlaylists = () => {
  const [list, setList] = useState(() => state.kg_subscribed_playlists);
  useEffect(() => {
    const handleUpdate = () => {
      setList([...state.kg_subscribed_playlists]);
    };
    global.state_event.on('kgSubscribedPlaylistsChanged', handleUpdate);
    handleUpdate();
    return () => {
      global.state_event.off('kgSubscribedPlaylistsChanged', handleUpdate);
    };
  }, []);
  return list;
};

// ===================== 酷我音乐 =====================
export const useKwUid = () => {
  const [uid, setUid] = useState(state.kw_uid);

  useEffect(() => {
    const handleUpdate = () => {
      setUid(state.kw_uid);
    };
    global.state_event.on('kwUidChanged', handleUpdate);
    handleUpdate();
    return () => {
      global.state_event.off('kwUidChanged', handleUpdate);
    };
  }, []);

  return uid;
}

export const useIsKwLiked = (songId: string | number) => {
  const strId = String(songId)
  const [isLiked, setIsLiked] = useState(() => state.kw_liked_song_ids.has(strId))

  useEffect(() => {
    const handleUpdate = () => {
      const newLikedStatus = state.kw_liked_song_ids.has(strId)
      setIsLiked(currentStatus => currentStatus === newLikedStatus ? currentStatus : newLikedStatus)
    }
    global.state_event.on('kwLikedListChanged', handleUpdate)
    handleUpdate()
    return () => {
      global.state_event.off('kwLikedListChanged', handleUpdate)
    }
  }, [strId]) // 依赖项数组保持不变，仅当 songId 变化时才重新设置 effect

  return isLiked
}

export const useIsKwArtistFollowed = (artistId: string | number | undefined) => { // 允许传入 undefined
  const strId = String(artistId)
  const [isFollowed, setIsFollowed] = useState(() => artistId === undefined || artistId === null ? false : state.kw_followed_artists.some(a => String(a.id) === strId))

  useEffect(() => {
    // 当 artistId 无效时，确保状态为 false
    if (artistId === undefined || artistId === null) {
      setIsFollowed(false)
      return
    }

    const handleUpdate = () => {
      const newFollowedStatus = state.kw_followed_artists.some(a => String(a.id) === strId)
      setIsFollowed(newFollowedStatus)
    }

    global.state_event.on('kwFollowedListChanged', handleUpdate)
    handleUpdate() // 首次加载或 artistId 变化时，立即检查并更新状态

    return () => {
      global.state_event.off('kwFollowedListChanged', handleUpdate)
    }
  }, [strId, artistId]) // 同时依赖 strId 和 artistId

  return isFollowed
}

export const useKwFollowedArtists = () => {
  const [list, setList] = useState(() => state.kw_followed_artists)

  useEffect(() => {
    const handleUpdate = () => {
      setList([...state.kw_followed_artists])
    }
    global.state_event.on('kwFollowedListChanged', handleUpdate)
    handleUpdate()
    return () => {
      global.state_event.off('kwFollowedListChanged', handleUpdate)
    }
  }, [])

  return list
}


export const useIsKwAlbumSubscribed = (albumId: string | number | undefined) => {
  const strId = String(albumId);
  const [isSubscribed, setIsSubscribed] = useState(() =>
    albumId === undefined || albumId === null ? false : state.kw_subscribed_albums.some(a => String(a.id) === strId),
  );

  useEffect(() => {
    if (albumId === undefined || albumId === null) {
      setIsSubscribed(false);
      return;
    }

    const handleUpdate = () => {
      const newSubscribedStatus = state.kw_subscribed_albums.some(a => String(a.id) === strId);
      setIsSubscribed(newSubscribedStatus);
    };

    global.state_event.on('kwSubscribedAlbumsChanged', handleUpdate);
    handleUpdate();

    return () => {
      global.state_event.off('kwSubscribedAlbumsChanged', handleUpdate);
    };
  }, [strId, albumId]);

  return isSubscribed;
};

export const useKwSubscribedAlbums = () => {
  const [list, setList] = useState(() => state.kw_subscribed_albums);
  useEffect(() => {
    const handleUpdate = () => {
      setList([...state.kw_subscribed_albums]);
    };
    global.state_event.on('kwSubscribedAlbumsChanged', handleUpdate);
    handleUpdate();
    return () => {
      global.state_event.off('kwSubscribedAlbumsChanged', handleUpdate);
    };
  }, []);
  return list;
};

export const useIsKwPlaylistSubscribed = (playlistId: string | number | undefined) => {
  const strId = String(playlistId);
  const [isSubscribed, setIsSubscribed] = useState(() =>
    playlistId === undefined || playlistId === null ? false : state.kw_subscribed_playlists.some(p => String(p.id) === strId),
  );

  useEffect(() => {
    if (playlistId === undefined || playlistId === null) {
      setIsSubscribed(false);
      return;
    }
    const handleUpdate = () => {
      const newSubscribedStatus = state.kw_subscribed_playlists.some(p => String(p.id) === strId);
      setIsSubscribed(newSubscribedStatus);
    };
    global.state_event.on('kwSubscribedPlaylistsChanged', handleUpdate);
    handleUpdate();
    return () => {
      global.state_event.off('kwSubscribedPlaylistsChanged', handleUpdate);
    };
  }, [strId, playlistId]);

  return isSubscribed;
};

export const useKwSubscribedPlaylists = () => {
  const [list, setList] = useState(() => state.kw_subscribed_playlists);
  useEffect(() => {
    const handleUpdate = () => {
      setList([...state.kw_subscribed_playlists]);
    };
    global.state_event.on('kwSubscribedPlaylistsChanged', handleUpdate);
    handleUpdate();
    return () => {
      global.state_event.off('kwSubscribedPlaylistsChanged', handleUpdate);
    };
  }, []);
  return list;
};

// ===================== 咪咕音乐 =====================
export const useMgUid = () => {
  const [uid, setUid] = useState(state.mg_uid);

  useEffect(() => {
    const handleUpdate = () => {
      setUid(state.mg_uid);
    };
    global.state_event.on('mgUidChanged', handleUpdate);
    handleUpdate();
    return () => {
      global.state_event.off('mgUidChanged', handleUpdate);
    };
  }, []);

  return uid;
}

export const useIsMgLiked = (songId: string | number) => {
  const strId = String(songId)
  const [isLiked, setIsLiked] = useState(() => state.mg_liked_song_ids.has(strId))

  useEffect(() => {
    const handleUpdate = () => {
      const newLikedStatus = state.mg_liked_song_ids.has(strId)
      setIsLiked(currentStatus => currentStatus === newLikedStatus ? currentStatus : newLikedStatus)
    }
    global.state_event.on('mgLikedListChanged', handleUpdate)
    handleUpdate()
    return () => {
      global.state_event.off('mgLikedListChanged', handleUpdate)
    }
  }, [strId]) // 依赖项数组保持不变，仅当 songId 变化时才重新设置 effect

  return isLiked
}

export const useIsMgArtistFollowed = (artistId: string | number | undefined) => { // 允许传入 undefined
  const strId = String(artistId)
  const [isFollowed, setIsFollowed] = useState(() => artistId === undefined || artistId === null ? false : state.mg_followed_artists.some(a => String(a.id) === strId))

  useEffect(() => {
    // 当 artistId 无效时，确保状态为 false
    if (artistId === undefined || artistId === null) {
      setIsFollowed(false)
      return
    }

    const handleUpdate = () => {
      const newFollowedStatus = state.mg_followed_artists.some(a => String(a.id) === strId)
      setIsFollowed(newFollowedStatus)
    }

    global.state_event.on('mgFollowedListChanged', handleUpdate)
    handleUpdate() // 首次加载或 artistId 变化时，立即检查并更新状态

    return () => {
      global.state_event.off('mgFollowedListChanged', handleUpdate)
    }
  }, [strId, artistId]) // 同时依赖 strId 和 artistId

  return isFollowed
}

export const useMgFollowedArtists = () => {
  const [list, setList] = useState(() => state.mg_followed_artists)

  useEffect(() => {
    const handleUpdate = () => {
      setList([...state.mg_followed_artists])
    }
    global.state_event.on('mgFollowedListChanged', handleUpdate)
    handleUpdate()
    return () => {
      global.state_event.off('mgFollowedListChanged', handleUpdate)
    }
  }, [])

  return list
}


export const useIsMgAlbumSubscribed = (albumId: string | number | undefined) => {
  const strId = String(albumId);
  const [isSubscribed, setIsSubscribed] = useState(() =>
    albumId === undefined || albumId === null ? false : state.mg_subscribed_albums.some(a => String(a.id) === strId),
  );

  useEffect(() => {
    if (albumId === undefined || albumId === null) {
      setIsSubscribed(false);
      return;
    }

    const handleUpdate = () => {
      const newSubscribedStatus = state.mg_subscribed_albums.some(a => String(a.id) === strId);
      setIsSubscribed(newSubscribedStatus);
    };

    global.state_event.on('mgSubscribedAlbumsChanged', handleUpdate);
    handleUpdate();

    return () => {
      global.state_event.off('mgSubscribedAlbumsChanged', handleUpdate);
    };
  }, [strId, albumId]);

  return isSubscribed;
};

export const useMgSubscribedAlbums = () => {
  const [list, setList] = useState(() => state.mg_subscribed_albums);
  useEffect(() => {
    const handleUpdate = () => {
      setList([...state.mg_subscribed_albums]);
    };
    global.state_event.on('mgSubscribedAlbumsChanged', handleUpdate);
    handleUpdate();
    return () => {
      global.state_event.off('mgSubscribedAlbumsChanged', handleUpdate);
    };
  }, []);
  return list;
};

export const useIsMgPlaylistSubscribed = (playlistId: string | number | undefined) => {
  const strId = String(playlistId);
  const [isSubscribed, setIsSubscribed] = useState(() =>
    playlistId === undefined || playlistId === null ? false : state.mg_subscribed_playlists.some(p => String(p.id) === strId),
  );

  useEffect(() => {
    if (playlistId === undefined || playlistId === null) {
      setIsSubscribed(false);
      return;
    }
    const handleUpdate = () => {
      const newSubscribedStatus = state.mg_subscribed_playlists.some(p => String(p.id) === strId);
      setIsSubscribed(newSubscribedStatus);
    };
    global.state_event.on('mgSubscribedPlaylistsChanged', handleUpdate);
    handleUpdate();
    return () => {
      global.state_event.off('mgSubscribedPlaylistsChanged', handleUpdate);
    };
  }, [strId, playlistId]);

  return isSubscribed;
};

export const useMgSubscribedPlaylists = () => {
  const [list, setList] = useState(() => state.mg_subscribed_playlists);
  useEffect(() => {
    const handleUpdate = () => {
      setList([...state.mg_subscribed_playlists]);
    };
    global.state_event.on('mgSubscribedPlaylistsChanged', handleUpdate);
    handleUpdate();
    return () => {
      global.state_event.off('mgSubscribedPlaylistsChanged', handleUpdate);
    };
  }, []);
  return list;
};
