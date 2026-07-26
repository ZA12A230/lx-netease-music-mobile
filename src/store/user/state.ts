export interface FollowedArtistInfo {
  id: string | number
  name: string
  alias: string[] | null
  albumSize: number
  picUrl: string
  img1v1Url: string
}
export interface SubscribedAlbumInfo {
  id: string | number
  name: string
  picUrl: string
  artists: Array<{ id: string | number, name: string }>
  publishTime: number
  size: number
}
export interface SubscribedPlaylistInfo {
  id: string | number
  userId: number
  name: string
  coverImgUrl: string
  trackCount: number
  description?: string
}

/** 平台用户数据 */
export interface PlatformUserData {
  uid: string | null
  liked_song_ids: Set<string>
  followed_artists: FollowedArtistInfo[]
  subscribed_albums: SubscribedAlbumInfo[]
  subscribed_playlists: SubscribedPlaylistInfo[]
  vip_type: number
}

const createPlatformUserData = (): PlatformUserData => ({
  uid: null,
  liked_song_ids: new Set(),
  followed_artists: [],
  subscribed_albums: [],
  subscribed_playlists: [],
  vip_type: 0,
})

export interface InitState {
  /** 网易云音乐 */
  wy_uid: string | null
  wy_liked_song_ids: Set<string>
  wy_followed_artists: FollowedArtistInfo[]
  wy_subscribed_albums: SubscribedAlbumInfo[]
  wy_subscribed_playlists: SubscribedPlaylistInfo[]
  wy_vip_type: number

  /** QQ音乐 */
  tx_uid: string | null
  tx_liked_song_ids: Set<string>
  tx_followed_artists: FollowedArtistInfo[]
  tx_subscribed_albums: SubscribedAlbumInfo[]
  tx_subscribed_playlists: SubscribedPlaylistInfo[]
  tx_vip_type: number

  /** 酷狗音乐 */
  kg_uid: string | null
  kg_liked_song_ids: Set<string>
  kg_followed_artists: FollowedArtistInfo[]
  kg_subscribed_albums: SubscribedAlbumInfo[]
  kg_subscribed_playlists: SubscribedPlaylistInfo[]
  kg_vip_type: number

  /** 酷我音乐 */
  kw_uid: string | null
  kw_liked_song_ids: Set<string>
  kw_followed_artists: FollowedArtistInfo[]
  kw_subscribed_albums: SubscribedAlbumInfo[]
  kw_subscribed_playlists: SubscribedPlaylistInfo[]
  kw_vip_type: number

  /** 咪咕音乐 */
  mg_uid: string | null
  mg_liked_song_ids: Set<string>
  mg_followed_artists: FollowedArtistInfo[]
  mg_subscribed_albums: SubscribedAlbumInfo[]
  mg_subscribed_playlists: SubscribedPlaylistInfo[]
  mg_vip_type: number
}

const state: InitState = {
  wy_uid: null,
  wy_liked_song_ids: new Set(),
  wy_followed_artists: [],
  wy_subscribed_albums: [],
  wy_subscribed_playlists: [],
  wy_vip_type: 0,

  tx_uid: null,
  tx_liked_song_ids: new Set(),
  tx_followed_artists: [],
  tx_subscribed_albums: [],
  tx_subscribed_playlists: [],
  tx_vip_type: 0,

  kg_uid: null,
  kg_liked_song_ids: new Set(),
  kg_followed_artists: [],
  kg_subscribed_albums: [],
  kg_subscribed_playlists: [],
  kg_vip_type: 0,

  kw_uid: null,
  kw_liked_song_ids: new Set(),
  kw_followed_artists: [],
  kw_subscribed_albums: [],
  kw_subscribed_playlists: [],
  kw_vip_type: 0,

  mg_uid: null,
  mg_liked_song_ids: new Set(),
  mg_followed_artists: [],
  mg_subscribed_albums: [],
  mg_subscribed_playlists: [],
  mg_vip_type: 0,
}

export default state