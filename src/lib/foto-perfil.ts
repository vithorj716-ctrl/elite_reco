/**
 * Foto de perfil do agente: recorte quadrado, compressão e formato seguro.
 * Nada de Base64 no banco — o resultado é um Blob enviado ao Storage.
 */

function formatoSuportado(): "image/webp" | "image/jpeg" {
  try {
    const teste = document.createElement("canvas");
    teste.width = 1;
    teste.height = 1;
    return teste.toDataURL("image/webp").startsWith("data:image/webp")
      ? "image/webp"
      : "image/jpeg";
  } catch {
    return "image/jpeg";
  }
}

/** Gera um quadrado centralizado com o lado informado (padrão 512px). */
export async function comprimirFotoPerfil(arquivo: File | Blob, lado = 512): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo);
  const corte = Math.min(bitmap.width, bitmap.height);
  const x = (bitmap.width - corte) / 2;
  const y = (bitmap.height - corte) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = lado;
  canvas.height = lado;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível preparar a imagem neste dispositivo.");
  ctx.drawImage(bitmap, x, y, corte, corte, 0, 0, lado, lado);

  const tipo = formatoSuportado();
  const blob = await new Promise<Blob | null>((r) =>
    canvas.toBlob(r, tipo, tipo === "image/webp" ? 0.82 : 0.86),
  );
  if (!blob) throw new Error("Falha ao processar a foto.");
  return blob;
}

/** Extensão do arquivo conforme o tipo do blob. */
export function extensaoDoBlob(blob: Blob) {
  return blob.type.includes("webp") ? "webp" : "jpg";
}
