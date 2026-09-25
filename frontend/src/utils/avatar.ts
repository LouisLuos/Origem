/**
 * Gera uma variante quadrada (1:1) da mesma foto (mesma seed do picsum), para uso em avatares.
 * Evita recortar o retrato original ao forçá-lo num quadro quadrado pequeno.
 */
export function getAvatarUrl(photoUrl: string, size = 400): string {
  const match = photoUrl.match(/^(https:\/\/picsum\.photos\/seed\/[^/]+\/)\d+\/\d+$/)
  if (!match) return photoUrl
  return `${match[1]}${size}/${size}`
}
