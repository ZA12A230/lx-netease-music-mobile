import state, {FollowedArtistInfo, SubscribedAlbumInfo, SubscribedPlaylistInfo} from './state'

export const setWyUid = (uid: string) => {
  state.wy_uid = uid
  global.state_event.wyUidChanged()
}
export const setWyVipType = (type: number) => {
  state.wy_vip_type = type
}
export const setWyLikedSongs = (ids: (string | number)[]) => {
  state.wy_liked_song_ids = new Set(ids.map(String))
  global.state_event.wyLikedListChanged()
}
export const addWyLikedSong = (id: string | number) => {
  const strId = String(id)
  if (state.wy_liked_song_ids.has(strId)) return
  state.wy_liked_song_ids.add(strId)
  global.state_event.wyLikedListChanged()
}
export const removeWyLikedSong = (id: string | number) => {
  const strId = String(id)
  if (!state.wy_liked_song_ids.has(strId)) return
  state.wy_liked_song_ids.delete(strId)
  global.state_event.wyLikedListChanged()
}

export const setWyFollowedArtists = (artists: FollowedArtistInfo[]) => {
  state.wy_followed_artists = artists
  global.state_event.wyFollowedListChanged()
}

export const addWyFollowedArtist = (artist: FollowedArtistInfo) => {
  if (state.wy_followed_artists.some(a => String(a.id) === String(artist.id))) return
  // 创建一个新数组，而不是修改原数组
  state.wy_followed_artists = [artist, ...state.wy_followed_artists]
  global.state_event.wyFollowedListChanged()
}

export const removeWyFollowedArtist = (id: string | number) => {
  const strId = String(id)
  const index = state.wy_followed_artists.findIndex(a => String(a.id) === strId)
  if (index < 0) return
  // 创建一个新数组，而不是修改原数组
  const newList = [...state.wy_followed_artists]
  newList.splice(index, 1)
  state.wy_followed_artists = newList
  global.state_event.wyFollowedListChanged()
}

export const setWySubscribedAlbums = (albums: SubscribedAlbumInfo[]) => {
  state.wy_subscribed_albums = albums;
  global.state_event.wySubscribedAlbumsChanged();
};

export const addWySubscribedAlbum = (album: SubscribedAlbumInfo) => {
  if (state.wy_subscribed_albums.some(a => String(a.id) === String(album.id))) return;
  state.wy_subscribed_albums = [album, ...state.wy_subscribed_albums];
  global.state_event.wySubscribedAlbumsChanged();
};

export const removeWySubscribedAlbum = (id: string | number) => {
  const strId = String(id);
  const index = state.wy_subscribed_albums.findIndex(a => String(a.id) === strId);
  if (index < 0) return;
  const newList = [...state.wy_subscribed_albums];
  newList.splice(index, 1);
  state.wy_subscribed_albums = newList;
  global.state_event.wySubscribedAlbumsChanged();
};

export const setWySubscribedPlaylists = (playlists: SubscribedPlaylistInfo[]) => {
  state.wy_subscribed_playlists = playlists;
  global.state_event.wySubscribedPlaylistsChanged();
};

export const addWySubscribedPlaylist = (playlist: SubscribedPlaylistInfo) => {
  if (state.wy_subscribed_playlists.some(p => String(p.id) === String(playlist.id))) return;
  state.wy_subscribed_playlists = [playlist, ...state.wy_subscribed_playlists];
  global.state_event.wySubscribedPlaylistsChanged();
};

export const removeWySubscribedPlaylist = (id: string | number) => {
  const strId = String(id);
  const index = state.wy_subscribed_playlists.findIndex(p => String(p.id) === strId);
  if (index < 0) return;
  const newList = [...state.wy_subscribed_playlists];
  newList.splice(index, 1);
  state.wy_subscribed_playlists = newList;
  global.state_event.wySubscribedPlaylistsChanged();
};

export const updateWySubscribedPlaylist = (id: string | number, details: Partial<SubscribedPlaylistInfo>) => {
  const strId = String(id)
  const index = state.wy_subscribed_playlists.findIndex(p => String(p.id) === strId)
  if (index > -1) {
    const updatedPlaylist = { ...state.wy_subscribed_playlists[index], ...details }
    const newList = [...state.wy_subscribed_playlists]
    newList.splice(index, 1, updatedPlaylist)
    state.wy_subscribed_playlists = newList
    global.state_event.wySubscribedPlaylistsChanged()
  }
}
export const updateWySubscribedPlaylistTrackCount = (id: string | number, change: number) => {
  const strId = String(id);
  const index = state.wy_subscribed_playlists.findIndex(p => String(p.id) === strId);

  if (index > -1) {
    const updatedPlaylist = {
      ...state.wy_subscribed_playlists[index],
      trackCount: state.wy_subscribed_playlists[index].trackCount + change,
    };
    const newList = [...state.wy_subscribed_playlists];
    newList.splice(index, 1, updatedPlaylist);

    state.wy_subscribed_playlists = newList;
    global.state_event.wySubscribedPlaylistsChanged();
  }
};

// ===================== QQ音乐 =====================
export const setTxUid = (uid: string) => {
  state.tx_uid = uid
  global.state_event.txUidChanged()
}
export const setTxVipType = (type: number) => {
  state.tx_vip_type = type
}
export const setTxLikedSongs = (ids: (string | number)[]) => {
  state.tx_liked_song_ids = new Set(ids.map(String))
  global.state_event.txLikedListChanged()
}
export const addTxLikedSong = (id: string | number) => {
  const strId = String(id)
  if (state.tx_liked_song_ids.has(strId)) return
  state.tx_liked_song_ids.add(strId)
  global.state_event.txLikedListChanged()
}
export const removeTxLikedSong = (id: string | number) => {
  const strId = String(id)
  if (!state.tx_liked_song_ids.has(strId)) return
  state.tx_liked_song_ids.delete(strId)
  global.state_event.txLikedListChanged()
}

export const setTxFollowedArtists = (artists: FollowedArtistInfo[]) => {
  state.tx_followed_artists = artists
  global.state_event.txFollowedListChanged()
}

export const addTxFollowedArtist = (artist: FollowedArtistInfo) => {
  if (state.tx_followed_artists.some(a => String(a.id) === String(artist.id))) return
  // 创建一个新数组，而不是修改原数组
  state.tx_followed_artists = [artist, ...state.tx_followed_artists]
  global.state_event.txFollowedListChanged()
}

export const removeTxFollowedArtist = (id: string | number) => {
  const strId = String(id)
  const index = state.tx_followed_artists.findIndex(a => String(a.id) === strId)
  if (index < 0) return
  // 创建一个新数组，而不是修改原数组
  const newList = [...state.tx_followed_artists]
  newList.splice(index, 1)
  state.tx_followed_artists = newList
  global.state_event.txFollowedListChanged()
}

export const setTxSubscribedAlbums = (albums: SubscribedAlbumInfo[]) => {
  state.tx_subscribed_albums = albums;
  global.state_event.txSubscribedAlbumsChanged();
};

export const addTxSubscribedAlbum = (album: SubscribedAlbumInfo) => {
  if (state.tx_subscribed_albums.some(a => String(a.id) === String(album.id))) return;
  state.tx_subscribed_albums = [album, ...state.tx_subscribed_albums];
  global.state_event.txSubscribedAlbumsChanged();
};

export const removeTxSubscribedAlbum = (id: string | number) => {
  const strId = String(id);
  const index = state.tx_subscribed_albums.findIndex(a => String(a.id) === strId);
  if (index < 0) return;
  const newList = [...state.tx_subscribed_albums];
  newList.splice(index, 1);
  state.tx_subscribed_albums = newList;
  global.state_event.txSubscribedAlbumsChanged();
};

export const setTxSubscribedPlaylists = (playlists: SubscribedPlaylistInfo[]) => {
  state.tx_subscribed_playlists = playlists;
  global.state_event.txSubscribedPlaylistsChanged();
};

export const addTxSubscribedPlaylist = (playlist: SubscribedPlaylistInfo) => {
  if (state.tx_subscribed_playlists.some(p => String(p.id) === String(playlist.id))) return;
  state.tx_subscribed_playlists = [playlist, ...state.tx_subscribed_playlists];
  global.state_event.txSubscribedPlaylistsChanged();
};

export const removeTxSubscribedPlaylist = (id: string | number) => {
  const strId = String(id);
  const index = state.tx_subscribed_playlists.findIndex(p => String(p.id) === strId);
  if (index < 0) return;
  const newList = [...state.tx_subscribed_playlists];
  newList.splice(index, 1);
  state.tx_subscribed_playlists = newList;
  global.state_event.txSubscribedPlaylistsChanged();
};

// ===================== 酷狗音乐 =====================
export const setKgUid = (uid: string) => {
  state.kg_uid = uid
  global.state_event.kgUidChanged()
}
export const setKgVipType = (type: number) => {
  state.kg_vip_type = type
}
export const setKgLikedSongs = (ids: (string | number)[]) => {
  state.kg_liked_song_ids = new Set(ids.map(String))
  global.state_event.kgLikedListChanged()
}
export const addKgLikedSong = (id: string | number) => {
  const strId = String(id)
  if (state.kg_liked_song_ids.has(strId)) return
  state.kg_liked_song_ids.add(strId)
  global.state_event.kgLikedListChanged()
}
export const removeKgLikedSong = (id: string | number) => {
  const strId = String(id)
  if (!state.kg_liked_song_ids.has(strId)) return
  state.kg_liked_song_ids.delete(strId)
  global.state_event.kgLikedListChanged()
}

export const setKgFollowedArtists = (artists: FollowedArtistInfo[]) => {
  state.kg_followed_artists = artists
  global.state_event.kgFollowedListChanged()
}

export const addKgFollowedArtist = (artist: FollowedArtistInfo) => {
  if (state.kg_followed_artists.some(a => String(a.id) === String(artist.id))) return
  // 创建一个新数组，而不是修改原数组
  state.kg_followed_artists = [artist, ...state.kg_followed_artists]
  global.state_event.kgFollowedListChanged()
}

export const removeKgFollowedArtist = (id: string | number) => {
  const strId = String(id)
  const index = state.kg_followed_artists.findIndex(a => String(a.id) === strId)
  if (index < 0) return
  // 创建一个新数组，而不是修改原数组
  const newList = [...state.kg_followed_artists]
  newList.splice(index, 1)
  state.kg_followed_artists = newList
  global.state_event.kgFollowedListChanged()
}

export const setKgSubscribedAlbums = (albums: SubscribedAlbumInfo[]) => {
  state.kg_subscribed_albums = albums;
  global.state_event.kgSubscribedAlbumsChanged();
};

export const addKgSubscribedAlbum = (album: SubscribedAlbumInfo) => {
  if (state.kg_subscribed_albums.some(a => String(a.id) === String(album.id))) return;
  state.kg_subscribed_albums = [album, ...state.kg_subscribed_albums];
  global.state_event.kgSubscribedAlbumsChanged();
};

export const removeKgSubscribedAlbum = (id: string | number) => {
  const strId = String(id);
  const index = state.kg_subscribed_albums.findIndex(a => String(a.id) === strId);
  if (index < 0) return;
  const newList = [...state.kg_subscribed_albums];
  newList.splice(index, 1);
  state.kg_subscribed_albums = newList;
  global.state_event.kgSubscribedAlbumsChanged();
};

export const setKgSubscribedPlaylists = (playlists: SubscribedPlaylistInfo[]) => {
  state.kg_subscribed_playlists = playlists;
  global.state_event.kgSubscribedPlaylistsChanged();
};

export const addKgSubscribedPlaylist = (playlist: SubscribedPlaylistInfo) => {
  if (state.kg_subscribed_playlists.some(p => String(p.id) === String(playlist.id))) return;
  state.kg_subscribed_playlists = [playlist, ...state.kg_subscribed_playlists];
  global.state_event.kgSubscribedPlaylistsChanged();
};

export const removeKgSubscribedPlaylist = (id: string | number) => {
  const strId = String(id);
  const index = state.kg_subscribed_playlists.findIndex(p => String(p.id) === strId);
  if (index < 0) return;
  const newList = [...state.kg_subscribed_playlists];
  newList.splice(index, 1);
  state.kg_subscribed_playlists = newList;
  global.state_event.kgSubscribedPlaylistsChanged();
};

// ===================== 酷我音乐 =====================
export const setKwUid = (uid: string) => {
  state.kw_uid = uid
  global.state_event.kwUidChanged()
}
export const setKwVipType = (type: number) => {
  state.kw_vip_type = type
}
export const setKwLikedSongs = (ids: (string | number)[]) => {
  state.kw_liked_song_ids = new Set(ids.map(String))
  global.state_event.kwLikedListChanged()
}
export const addKwLikedSong = (id: string | number) => {
  const strId = String(id)
  if (state.kw_liked_song_ids.has(strId)) return
  state.kw_liked_song_ids.add(strId)
  global.state_event.kwLikedListChanged()
}
export const removeKwLikedSong = (id: string | number) => {
  const strId = String(id)
  if (!state.kw_liked_song_ids.has(strId)) return
  state.kw_liked_song_ids.delete(strId)
  global.state_event.kwLikedListChanged()
}

export const setKwFollowedArtists = (artists: FollowedArtistInfo[]) => {
  state.kw_followed_artists = artists
  global.state_event.kwFollowedListChanged()
}

export const addKwFollowedArtist = (artist: FollowedArtistInfo) => {
  if (state.kw_followed_artists.some(a => String(a.id) === String(artist.id))) return
  // 创建一个新数组，而不是修改原数组
  state.kw_followed_artists = [artist, ...state.kw_followed_artists]
  global.state_event.kwFollowedListChanged()
}

export const removeKwFollowedArtist = (id: string | number) => {
  const strId = String(id)
  const index = state.kw_followed_artists.findIndex(a => String(a.id) === strId)
  if (index < 0) return
  // 创建一个新数组，而不是修改原数组
  const newList = [...state.kw_followed_artists]
  newList.splice(index, 1)
  state.kw_followed_artists = newList
  global.state_event.kwFollowedListChanged()
}

export const setKwSubscribedAlbums = (albums: SubscribedAlbumInfo[]) => {
  state.kw_subscribed_albums = albums;
  global.state_event.kwSubscribedAlbumsChanged();
};

export const addKwSubscribedAlbum = (album: SubscribedAlbumInfo) => {
  if (state.kw_subscribed_albums.some(a => String(a.id) === String(album.id))) return;
  state.kw_subscribed_albums = [album, ...state.kw_subscribed_albums];
  global.state_event.kwSubscribedAlbumsChanged();
};

export const removeKwSubscribedAlbum = (id: string | number) => {
  const strId = String(id);
  const index = state.kw_subscribed_albums.findIndex(a => String(a.id) === strId);
  if (index < 0) return;
  const newList = [...state.kw_subscribed_albums];
  newList.splice(index, 1);
  state.kw_subscribed_albums = newList;
  global.state_event.kwSubscribedAlbumsChanged();
};

export const setKwSubscribedPlaylists = (playlists: SubscribedPlaylistInfo[]) => {
  state.kw_subscribed_playlists = playlists;
  global.state_event.kwSubscribedPlaylistsChanged();
};

export const addKwSubscribedPlaylist = (playlist: SubscribedPlaylistInfo) => {
  if (state.kw_subscribed_playlists.some(p => String(p.id) === String(playlist.id))) return;
  state.kw_subscribed_playlists = [playlist, ...state.kw_subscribed_playlists];
  global.state_event.kwSubscribedPlaylistsChanged();
};

export const removeKwSubscribedPlaylist = (id: string | number) => {
  const strId = String(id);
  const index = state.kw_subscribed_playlists.findIndex(p => String(p.id) === strId);
  if (index < 0) return;
  const newList = [...state.kw_subscribed_playlists];
  newList.splice(index, 1);
  state.kw_subscribed_playlists = newList;
  global.state_event.kwSubscribedPlaylistsChanged();
};

// ===================== 咪咕音乐 =====================
export const setMgUid = (uid: string) => {
  state.mg_uid = uid
  global.state_event.mgUidChanged()
}
export const setMgVipType = (type: number) => {
  state.mg_vip_type = type
}
export const setMgLikedSongs = (ids: (string | number)[]) => {
  state.mg_liked_song_ids = new Set(ids.map(String))
  global.state_event.mgLikedListChanged()
}
export const addMgLikedSong = (id: string | number) => {
  const strId = String(id)
  if (state.mg_liked_song_ids.has(strId)) return
  state.mg_liked_song_ids.add(strId)
  global.state_event.mgLikedListChanged()
}
export const removeMgLikedSong = (id: string | number) => {
  const strId = String(id)
  if (!state.mg_liked_song_ids.has(strId)) return
  state.mg_liked_song_ids.delete(strId)
  global.state_event.mgLikedListChanged()
}

export const setMgFollowedArtists = (artists: FollowedArtistInfo[]) => {
  state.mg_followed_artists = artists
  global.state_event.mgFollowedListChanged()
}

export const addMgFollowedArtist = (artist: FollowedArtistInfo) => {
  if (state.mg_followed_artists.some(a => String(a.id) === String(artist.id))) return
  // 创建一个新数组，而不是修改原数组
  state.mg_followed_artists = [artist, ...state.mg_followed_artists]
  global.state_event.mgFollowedListChanged()
}

export const removeMgFollowedArtist = (id: string | number) => {
  const strId = String(id)
  const index = state.mg_followed_artists.findIndex(a => String(a.id) === strId)
  if (index < 0) return
  // 创建一个新数组，而不是修改原数组
  const newList = [...state.mg_followed_artists]
  newList.splice(index, 1)
  state.mg_followed_artists = newList
  global.state_event.mgFollowedListChanged()
}

export const setMgSubscribedAlbums = (albums: SubscribedAlbumInfo[]) => {
  state.mg_subscribed_albums = albums;
  global.state_event.mgSubscribedAlbumsChanged();
};

export const addMgSubscribedAlbum = (album: SubscribedAlbumInfo) => {
  if (state.mg_subscribed_albums.some(a => String(a.id) === String(album.id))) return;
  state.mg_subscribed_albums = [album, ...state.mg_subscribed_albums];
  global.state_event.mgSubscribedAlbumsChanged();
};

export const removeMgSubscribedAlbum = (id: string | number) => {
  const strId = String(id);
  const index = state.mg_subscribed_albums.findIndex(a => String(a.id) === strId);
  if (index < 0) return;
  const newList = [...state.mg_subscribed_albums];
  newList.splice(index, 1);
  state.mg_subscribed_albums = newList;
  global.state_event.mgSubscribedAlbumsChanged();
};

export const setMgSubscribedPlaylists = (playlists: SubscribedPlaylistInfo[]) => {
  state.mg_subscribed_playlists = playlists;
  global.state_event.mgSubscribedPlaylistsChanged();
};

export const addMgSubscribedPlaylist = (playlist: SubscribedPlaylistInfo) => {
  if (state.mg_subscribed_playlists.some(p => String(p.id) === String(playlist.id))) return;
  state.mg_subscribed_playlists = [playlist, ...state.mg_subscribed_playlists];
  global.state_event.mgSubscribedPlaylistsChanged();
};

export const removeMgSubscribedPlaylist = (id: string | number) => {
  const strId = String(id);
  const index = state.mg_subscribed_playlists.findIndex(p => String(p.id) === strId);
  if (index < 0) return;
  const newList = [...state.mg_subscribed_playlists];
  newList.splice(index, 1);
  state.mg_subscribed_playlists = newList;
  global.state_event.mgSubscribedPlaylistsChanged();
};
