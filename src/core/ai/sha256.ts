/**
 * 纯 JS SHA-256 + HMAC-SHA256 实现
 * 用于科大讯飞 WebSocket 鉴权签名
 */

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])

const rotr = (n: number, x: number) => (x >>> n) | (x << (32 - n))

const sha256Block = (H: Uint32Array, block: Uint32Array) => {
  const W = new Uint32Array(64)
  for (let i = 0; i < 16; i++) W[i] = block[i]
  for (let i = 16; i < 64; i++) {
    const s0 = rotr(7, W[i - 15]) ^ rotr(18, W[i - 15]) ^ (W[i - 15] >>> 3)
    const s1 = rotr(17, W[i - 2]) ^ rotr(19, W[i - 2]) ^ (W[i - 2] >>> 10)
    W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0
  }
  let [a, b, c, d, e, f, g, h] = H
  for (let i = 0; i < 64; i++) {
    const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e)
    const ch = (e & f) ^ (~e & g)
    const t1 = (h + S1 + ch + K[i] + W[i]) | 0
    const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a)
    const maj = (a & b) ^ (a & c) ^ (b & c)
    const t2 = (S0 + maj) | 0
    h = g; g = f; f = e
    e = (d + t1) | 0
    d = c; c = b; b = a
    a = (t1 + t2) | 0
  }
  H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0
  H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0
}

export const sha256 = (data: Uint8Array): Uint8Array => {
  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ])
  const len = data.length
  const bitLen = len * 8
  // 填充
  const paddedLen = Math.ceil((len + 9) / 64) * 64
  const padded = new Uint8Array(paddedLen)
  padded.set(data)
  padded[len] = 0x80
  // 长度（64位大端，只取低32位）
  const dv = new DataView(padded.buffer)
  dv.setUint32(paddedLen - 4, bitLen >>> 0, false)
  dv.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false)

  for (let i = 0; i < paddedLen; i += 64) {
    const block = new Uint32Array(16)
    for (let j = 0; j < 16; j++) {
      block[j] = dv.getUint32(i + j * 4, false)
    }
    sha256Block(H, block)
  }
  const result = new Uint8Array(32)
  const rv = new DataView(result.buffer)
  for (let i = 0; i < 8; i++) rv.setUint32(i * 4, H[i], false)
  return result
}

export const hmacSha256 = (key: Uint8Array, message: Uint8Array): Uint8Array => {
  const blockSize = 64
  let k = key
  if (k.length > blockSize) k = sha256(k)
  if (k.length < blockSize) {
    const padded = new Uint8Array(blockSize)
    padded.set(k)
    k = padded
  }
  const oKeyPad = new Uint8Array(blockSize)
  const iKeyPad = new Uint8Array(blockSize)
  for (let i = 0; i < blockSize; i++) {
    oKeyPad[i] = k[i] ^ 0x5c
    iKeyPad[i] = k[i] ^ 0x36
  }
  const innerData = new Uint8Array(iKeyPad.length + message.length)
  innerData.set(iKeyPad)
  innerData.set(message, iKeyPad.length)
  const innerHash = sha256(innerData)
  const outerData = new Uint8Array(oKeyPad.length + innerHash.length)
  outerData.set(oKeyPad)
  outerData.set(innerHash, oKeyPad.length)
  return sha256(outerData)
}

// 字符串转 Uint8Array (UTF-8)
export const strToBytes = (str: string): Uint8Array => {
  const bytes: number[] = []
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i)
    if (c < 0x80) bytes.push(c)
    else if (c < 0x800) {
      bytes.push(0xc0 | (c >> 6))
      bytes.push(0x80 | (c & 0x3f))
    } else {
      bytes.push(0xe0 | (c >> 12))
      bytes.push(0x80 | ((c >> 6) & 0x3f))
      bytes.push(0x80 | (c & 0x3f))
    }
  }
  return new Uint8Array(bytes)
}

// Uint8Array 转 Base64
export const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  // 使用全局 base64（React Native 环境提供）
  if (typeof btoa === 'function') return btoa(binary)
  // 回退：手动编码
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let result = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] || 0
    const b1 = bytes[i + 1] || 0
    const b2 = bytes[i + 2] || 0
    result += chars[b0 >> 2]
    result += chars[((b0 & 3) << 4) | (b1 >> 4)]
    result += i + 1 < bytes.length ? chars[((b1 & 15) << 2) | (b2 >> 6)] : '='
    result += i + 2 < bytes.length ? chars[b2 & 63] : '='
  }
  return result
}
