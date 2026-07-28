/**
 * 歌手关系图谱
 * 分析歌手之间的合作关系、风格相似度
 */
import listState from '@/store/list/state'
import { getData, saveData } from '@/plugins/storage'
import { addDevLog } from './devKit'

export interface ArtistNode {
  id: string
  name: string
  songCount: number
  totalPlays: number
  /** 关联歌手ID列表 */
  collaborations: string[]
  /** 风格标签 */
  genres: string[]
}

export interface ArtistEdge {
  source: string
  target: string
  /** 合作次数 */
  collaborationCount: number
  /** 合作歌曲 */
  songs: Array<{ name: string; singer: string }>
  /** 关系强度 0-1 */
  strength: number
}

export interface ArtistGraph {
  nodes: ArtistNode[]
  edges: ArtistEdge[]
  totalArtists: number
  totalCollaborations: number
}

const GRAPH_KEY = '@artist_graph_v1'

/** 构建歌手图谱 */
export const buildArtistGraph = async (): Promise<ArtistGraph> => {
  const nodes = new Map<string, ArtistNode>()
  const edges = new Map<string, ArtistEdge>()

  // 遍历所有歌单
  for (const list of listState.allList) {
    for (const song of list.list) {
      const artists = parseArtists(song.singer)
      for (const artist of artists) {
        if (!nodes.has(artist)) {
          nodes.set(artist, {
            id: artist,
            name: artist,
            songCount: 0,
            totalPlays: 0,
            collaborations: [],
            genres: inferGenres(artist, song.name),
          })
        }
        nodes.get(artist)!.songCount++
      }

      // 如果有多个歌手，建立关系
      if (artists.length > 1) {
        for (let i = 0; i < artists.length; i++) {
          for (let j = i + 1; j < artists.length; j++) {
            const a = artists[i]
            const b = artists[j]
            const edgeKey = [a, b].sort().join('→')
            if (!edges.has(edgeKey)) {
              edges.set(edgeKey, {
                source: a,
                target: b,
                collaborationCount: 0,
                songs: [],
                strength: 0,
              })
            }
            const edge = edges.get(edgeKey)!
            edge.collaborationCount++
            edge.songs.push({ name: song.name, singer: song.singer })
          }
        }
      }
    }
  }

  // 计算关系强度
  for (const edge of edges.values()) {
    edge.strength = Math.min(1, edge.collaborationCount / 5) // 5次合作为满分
  }

  // 更新节点的 collaborations
  for (const edge of edges.values()) {
    if (nodes.has(edge.source)) {
      nodes.get(edge.source)!.collaborations.push(edge.target)
    }
    if (nodes.has(edge.target)) {
      nodes.get(edge.target)!.collaborations.push(edge.source)
    }
  }

  const graph: ArtistGraph = {
    nodes: Array.from(nodes.values()),
    edges: Array.from(edges.values()),
    totalArtists: nodes.size,
    totalCollaborations: edges.size,
  }

  await saveData(GRAPH_KEY, graph)
  addDevLog('info', 'ArtistGraph', `构建图谱: ${graph.totalArtists}位歌手, ${graph.totalCollaborations}个合作关系`)
  return graph
}

/** 解析歌手（处理"张三/李四"、"张三、李四"、"张三 & 李四"等格式） */
const parseArtists = (singer: string): string[] => {
  if (!singer) return ['未知歌手']
  // 按多种分隔符拆分
  const artists = singer.split(/[\/、,，&＆]|和|feat\.?|ft\.?/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  return artists.length > 0 ? artists : ['未知歌手']
}

/** 推断歌手流派 */
const inferGenres = (artist: string, songName: string): string[] => {
  const text = (artist + songName).toLowerCase()
  const genres: string[] = []
  if (/摇滚|rock|metal|punk/.test(text)) genres.push('摇滚')
  if (/流行|pop/.test(text)) genres.push('流行')
  if (/民谣|folk/.test(text)) genres.push('民谣')
  if (/电子|electronic|dj|dance/.test(text)) genres.push('电子')
  if (/说唱|rap|hiphop/.test(text)) genres.push('说唱')
  if (/古典|classical|钢琴|piano/.test(text)) genres.push('古典')
  if (/爵士|jazz/.test(text)) genres.push('爵士')
  if (genres.length === 0) genres.push('其他')
  return genres
}

/** 获取歌手的合作者 */
export const getCollaborators = async (artistName: string): Promise<ArtistEdge[]> => {
  const graph = await loadGraph()
  return graph.edges
    .filter((e) => e.source === artistName || e.target === artistName)
    .sort((a, b) => b.strength - a.strength)
}

/** 查找相似歌手（基于流派） */
export const findSimilarArtists = async (artistName: string, topN = 10): Promise<Array<{ artist: string; similarity: number; reason: string }>> => {
  const graph = await loadGraph()
  const targetNode = graph.nodes.find((n) => n.name === artistName)
  if (!targetNode) return []

  const results: Array<{ artist: string; similarity: number; reason: string }> = []

  for (const node of graph.nodes) {
    if (node.name === artistName) continue

    let similarity = 0
    const reasons: string[] = []

    // 流派相似度
    const commonGenres = node.genres.filter((g) => targetNode.genres.includes(g))
    if (commonGenres.length > 0) {
      similarity += commonGenres.length * 0.3
      reasons.push(`共同流派: ${commonGenres.join(', ')}`)
    }

    // 是否有合作
    const hasCollab = graph.edges.some((e) =>
      (e.source === artistName && e.target === node.name) ||
      (e.target === artistName && e.source === node.name)
    )
    if (hasCollab) {
      similarity += 0.2
      reasons.push('有过合作')
    }

    if (similarity > 0) {
      results.push({
        artist: node.name,
        similarity: Math.min(1, similarity),
        reason: reasons.join('；'),
      })
    }
  }

  results.sort((a, b) => b.similarity - a.similarity)
  return results.slice(0, topN)
}

/** 查找两个歌手的最短合作路径（BFS） */
export const findShortestPath = async (artistA: string, artistB: string): Promise<string[] | null> => {
  const graph = await loadGraph()
  if (!graph.nodes.find((n) => n.name === artistA) || !graph.nodes.find((n) => n.name === artistB)) {
    return null
  }

  const adjacency = new Map<string, string[]>()
  for (const node of graph.nodes) {
    adjacency.set(node.name, [])
  }
  for (const edge of graph.edges) {
    adjacency.get(edge.source)?.push(edge.target)
    adjacency.get(edge.target)?.push(edge.source)
  }

  // BFS
  const queue: Array<{ name: string; path: string[] }> = [{ name: artistA, path: [artistA] }]
  const visited = new Set<string>([artistA])

  while (queue.length > 0) {
    const current = queue.shift()!
    if (current.name === artistB) return current.path

    const neighbors = adjacency.get(current.name) || []
    for (const next of neighbors) {
      if (!visited.has(next)) {
        visited.add(next)
        queue.push({ name: next, path: [...current.path, next] })
      }
    }
  }

  return null
}

/** 获取歌手社群（聚类） */
export const getArtistCommunities = async (): Promise<Array<{ artists: string[]; commonGenres: string[] }>> => {
  const graph = await loadGraph()
  const visited = new Set<string>()
  const communities: Array<{ artists: string[]; commonGenres: string[] }> = []

  for (const node of graph.nodes) {
    if (visited.has(node.name)) continue

    // BFS 找到连通分量
    const community: string[] = []
    const queue = [node.name]
    const genreCount = new Map<string, number>()

    while (queue.length > 0) {
      const current = queue.shift()!
      if (visited.has(current)) continue
      visited.add(current)
      community.push(current)

      const currentNode = graph.nodes.find((n) => n.name === current)
      if (currentNode) {
        for (const g of currentNode.genres) {
          genreCount.set(g, (genreCount.get(g) || 0) + 1)
        }
      }

      const edges = graph.edges.filter((e) => e.source === current || e.target === current)
      for (const edge of edges) {
        const neighbor = edge.source === current ? edge.target : edge.source
        if (!visited.has(neighbor)) queue.push(neighbor)
      }
    }

    if (community.length > 1) {
      const commonGenres = Array.from(genreCount.entries())
        .filter(([, count]) => count >= community.length / 2)
        .map(([genre]) => genre)
      communities.push({ artists: community, commonGenres })
    }
  }

  communities.sort((a, b) => b.artists.length - a.artists.length)
  return communities
}

/** 获取图谱统计 */
export const getGraphStats = async () => {
  const graph = await loadGraph()
  const avgCollaborations = graph.nodes.length > 0
    ? graph.nodes.reduce((sum, n) => sum + n.collaborations.length, 0) / graph.nodes.length
    : 0

  const topArtists = [...graph.nodes]
    .sort((a, b) => b.songCount - a.songCount)
    .slice(0, 10)

  const topCollaborations = [...graph.edges]
    .sort((a, b) => b.collaborationCount - a.collaborationCount)
    .slice(0, 10)

  return {
    totalArtists: graph.totalArtists,
    totalCollaborations: graph.totalCollaborations,
    avgCollaborationsPerArtist: avgCollaborations,
    topArtists,
    topCollaborations,
  }
}

const loadGraph = async (): Promise<ArtistGraph> => {
  const data = await getData<ArtistGraph>(GRAPH_KEY)
  return data || { nodes: [], edges: [], totalArtists: 0, totalCollaborations: 0 }
}

/** 清空图谱 */
export const clearGraph = async (): Promise<void> => {
  await saveData(GRAPH_KEY, null)
  addDevLog('info', 'ArtistGraph', '歌手图谱已清空')
}
