/** Fixtures compartilhadas dos testes da HU-05 (uso exclusivo em testes). */

export const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
export const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);

export const FOTO_JPEG = { tipoMime: 'image/jpeg', conteudoBase64: JPEG_BYTES.toString('base64') };
export const FOTO_PNG = { tipoMime: 'image/png', conteudoBase64: PNG_BYTES.toString('base64') };

export function corpoPecaValido(): Record<string, unknown> {
  return {
    titulo: 'Boneco de Barro "Casal de Feira"',
    descricao: 'Peça modelada à mão no Alto do Moura, queimada em forno a lenha.',
    tipologia: 'Cerâmica Figurativa',
    preco: 189.9,
    pesoGramas: 850,
    comprimentoCm: 30,
    larguraCm: 20,
    alturaCm: 25,
    isFragil: true,
    fotos: [FOTO_JPEG, FOTO_PNG],
  };
}
