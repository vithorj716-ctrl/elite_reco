export interface DadosMarca {
  empresa: string;
  agente: string;
  placa: string;
  gps: string;
  locadora?: string;
  /** Quilometragem lida no painel — não substitui o GPS, convive com ele. */
  km?: string;
  cidade?: string;
  endereco?: string;
}

/** Monta o canvas comprimido com a marca d'água discreta e permanente. */
async function desenhar(arquivo: File | Blob, marca: DadosMarca): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(arquivo);
  const largura = Math.min(1440, bitmap.width);
  const escala = largura / bitmap.width;
  const altura = Math.round(bitmap.height * escala);

  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível");
  ctx.drawImage(bitmap, 0, 0, largura, altura);

  const agora = new Date();
  const resumo = (texto: string, limite: number) =>
    texto.length > limite ? `${texto.slice(0, limite - 1)}…` : texto;

  const linhas = [
    [marca.empresa.toUpperCase(), marca.locadora ? `• ${resumo(marca.locadora, 34)}` : ""]
      .filter(Boolean)
      .join(" "),
    `AGENTE: ${resumo(marca.agente, 30)}   PLACA: ${marca.placa.toUpperCase()}`,
    `${agora.toLocaleDateString("pt-BR")} ${agora.toLocaleTimeString("pt-BR")}${
      marca.cidade ? `   ${resumo(marca.cidade, 26)}` : ""
    }`,
    [marca.km ? `KM: ${marca.km}` : "", `GPS: ${marca.gps}`].filter(Boolean).join("   "),
    ...(marca.endereco ? [`LOCAL: ${resumo(marca.endereco, 58)}`] : []),
  ];

  const fonte = Math.max(11, Math.round(largura * 0.018));
  const pad = Math.round(fonte * 0.7);
  const alturaBloco = linhas.length * (fonte * 1.35) + pad * 2;

  ctx.fillStyle = "rgba(15,15,17,0.66)";
  ctx.fillRect(0, altura - alturaBloco, largura, alturaBloco);
  ctx.fillStyle = "#F2A33C";
  ctx.fillRect(0, altura - alturaBloco, 3, alturaBloco);

  ctx.font = `500 ${fonte}px ui-monospace, monospace`;
  ctx.textBaseline = "top";
  linhas.forEach((linha, i) => {
    ctx.fillStyle = i === 0 ? "#F2A33C" : "#E7E5E2";
    ctx.fillText(linha, pad + 6, altura - alturaBloco + pad + i * (fonte * 1.35));
  });

  return canvas;
}

/**
 * Nem todo aparelho gera WebP no canvas: quando não gera, o navegador devolve
 * PNG silenciosamente e a mesma foto passa de ~150 KB para vários megabytes —
 * foi isso que estava travando o carregamento e a sincronização. Aqui o
 * formato é conferido e, na falta de WebP, usamos JPEG.
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

/** Teto de segurança por foto (~420 KB em base64). */
const TETO = 420_000;

/** Comprime (com teto de tamanho) e aplica marca d'água obrigatória. */
export async function processarFoto(arquivo: File, marca: DadosMarca): Promise<string> {
  const canvas = await desenhar(arquivo, marca);
  const tipo = formatoSuportado();
  let qualidade = tipo === "image/webp" ? 0.62 : 0.72;
  let saida = canvas.toDataURL(tipo, qualidade);
  // Reduz a qualidade em passos até caber; a leitura da marca d'água é
  // preservada porque a redução para antes de degradar o texto.
  while (saida.length > TETO && qualidade > 0.4) {
    qualidade -= 0.1;
    saida = canvas.toDataURL(tipo, qualidade);
  }
  return saida;
}

/** Mesma marca d'água, porém em Blob — usada no envio para o Storage. */
export async function processarFotoBlob(arquivo: File | Blob, marca: DadosMarca): Promise<Blob> {
  const canvas = await desenhar(arquivo, marca);
  const tipo = formatoSuportado();
  const blob = await new Promise<Blob | null>((r) =>
    canvas.toBlob(r, tipo, tipo === "image/webp" ? 0.72 : 0.8),
  );
  if (!blob) throw new Error("Falha ao gerar a imagem com marca d'água");
  return blob;
}

export function obterGps(): Promise<string> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve("indisponível");
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(`${p.coords.latitude.toFixed(5)}, ${p.coords.longitude.toFixed(5)}`),
      () => resolve("indisponível"),
      { timeout: 6000 },
    );
  });
}

/** Coordenadas separadas — a vistoria guarda latitude e longitude em colunas próprias. */
export function obterCoordenadas(): Promise<{ latitude: string; longitude: string }> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return resolve({ latitude: "", longitude: "" });
    }
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          latitude: p.coords.latitude.toFixed(6),
          longitude: p.coords.longitude.toFixed(6),
        }),
      () => resolve({ latitude: "", longitude: "" }),
      { timeout: 6000 },
    );
  });
}
