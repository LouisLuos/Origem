const PICSUM_BASE_URL = 'https://picsum.photos/seed'
const PICSUM_GALLERY_REGEX = /^(https:\/\/picsum\.photos\/seed\/)([^/]+)(\/.+)$/
const PICSUM_AVATAR_REGEX = /^(https:\/\/picsum\.photos\/seed\/[^/]+\/)\d+\/\d+$/

/**
 * Deriva as URLs de galeria de uma peça.
 * Para URLs de prototipação do Picsum, gera variações de detalhe e ambiente;
 * para URLs de mídia reais (CDN/Storage) ou vazias, preserva a imagem original.
 */
export function getProductGalleryImages(imageUrl: string): string[] {
  const match = imageUrl.match(PICSUM_GALLERY_REGEX)
  if (!match) return [imageUrl]
  const [, prefix, seed, suffix] = match
  return [imageUrl, `${prefix}${seed}-detalhe${suffix}`, `${prefix}${seed}-ambiente${suffix}`]
}

/**
 * Gera uma variante quadrada (1:1) da mesma foto (mesma seed do picsum), para uso em avatares.
 * Evita recortar o retrato original ao forçá-lo num quadro quadrado pequeno.
 */
export function getSquareAvatarUrl(photoUrl: string, size = 400): string {
  const match = photoUrl.match(PICSUM_AVATAR_REGEX)
  if (!match) return photoUrl
  return `${match[1]}${size}/${size}`
}

/**
 * URL padrão provisória para peça cadastrada sem foto informada no painel do artesão.
 */
export function buildPlaceholderProductImageUrl(title: string): string {
  return `${PICSUM_BASE_URL}/origem-${encodeURIComponent(title)}/800/800`
}

/**
 * URLs provisórias de retrato e capa para novo perfil público de artesão.
 */
export function buildPlaceholderArtisanMedia(email: string): {
  photoUrl: string
  coverUrl: string
} {
  const encodedEmail = encodeURIComponent(email)
  return {
    photoUrl: `${PICSUM_BASE_URL}/artesao-${encodedEmail}/600/700`,
    coverUrl: `${PICSUM_BASE_URL}/atelie-${encodedEmail}/1600/500`,
  }
}

