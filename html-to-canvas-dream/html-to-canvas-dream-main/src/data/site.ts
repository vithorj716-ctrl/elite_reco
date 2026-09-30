/** Real catalogue photos served from /public so they load on any host (Lovable or Vercel). */
const c = (name: string) => `/catalogo/${name}.webp`;

export const catalog = {
  modeloRenda: c("modelo-renda"),
  modeloJeans: c("modelo-jeans"),
  modeloCetim: c("modelo-cetim"),
  modeloNoite: c("modelo-noite"),
  editorialRose: c("editorial-rose"),
  editorialRoseDetail: c("editorial-rose-detail"),
  editorialJeansFront: c("editorial-jeans-front"),
  editorialJeansBack: c("editorial-jeans-back"),
  alcasJeans: c("alcas-jeans"),
  alcasRose: c("alcas-rose"),
  alcasPreto: c("alcas-preto"),
  alcasFendi: c("alcas-fendi"),
  alcasBranco: c("alcas-branco"),
  tomaraOffwhite: c("tomara-cetim-offwhite"),
  tomaraPreto: c("tomara-cetim-preto"),
  tomaraRose: c("tomara-cetim-rose"),
  tomaraJeans: c("tomara-jeans"),
  tomaraFendi: c("tomara-fendi"),
  retoFendi: c("reto-fendi"),
  retoRose: c("reto-rose"),
  retoBranco: c("reto-branco"),
  retoPreto: c("reto-preto"),
  retoJeans: c("reto-jeans"),
};

const k = catalog;
const detailImage = k.retoBranco;
const auroraImage = k.modeloCetim;
const romanticImage = k.modeloRenda;
const violetaImage = k.modeloNoite;
const heroImage = k.modeloJeans;
const overbustImage = k.alcasPreto;
const underbustImage = k.tomaraRose;
const waistImage = k.retoPreto;

export const images = { detailImage, auroraImage, romanticImage, violetaImage, heroImage, overbustImage, underbustImage, waistImage };

export const benefits = ["Barbatanas de aço espiral", "Forro em algodão orgânico", "Acabamento à mão", "Prova virtual inclusa", "Garantia de ajuste"];

export const socials = {
  instagram: "https://www.instagram.com/oficialbekas",
  instagramHandle: "@oficialbekas",
} as const;

export const navigation = [
  { label: "Início", href: "#inicio" },
  { label: "Corsets", href: "#corsets" },
  { label: "Coleções", href: "#colecoes" },
  { label: "Sob medida", href: "#sob-medida" },
  { label: "Sobre", href: "#sobre" },
  { label: "Blog", href: "#blog" },
];

export const categories = [
  { title: "Overbust", image: overbustImage, detail: "Silhueta completa", note: "Do busto ao quadril, para quem busca presença total." },
  { title: "Underbust", image: underbustImage, detail: "Versatilidade clássica", note: "Abaixo do busto, sobre camisas, vestidos ou pele." },
  { title: "Waist cincher", image: waistImage, detail: "Cintura esculpida", note: "Curto e preciso, desenhado para marcar a cintura." },
  { title: "Custom", image: detailImage, detail: "Do zero, para você", note: "Modelagem, tecido e acabamento escolhidos a quatro mãos." },
];

export type Badge = "NOVO" | "BEST SELLER" | "EDIÇÃO LIMITADA";

export type Product = {
  id: string;
  slug: string;
  name: string;
  category: string;
  price: number;
  compareAtPrice?: number;
  installments: number;
  image: string;
  hoverImage: string;
  badge?: Badge;
  colors: string[];
  isNew?: boolean;
  isFeatured?: boolean;
};

export const products: Product[] = [
  { id: "p1", slug: "corset-alcas-jeans", name: "Corset Alças Jeans", category: "Com alças", price: 389.9, installments: 6, image: k.alcasJeans, hoverImage: k.tomaraJeans, badge: "NOVO", colors: ["#4f6f95"], isNew: true },
  { id: "p2", slug: "corset-cetim-offwhite", name: "Corset Cetim Off-white", category: "Tomara que caia", price: 429.9, installments: 6, image: k.tomaraOffwhite, hoverImage: k.retoBranco, badge: "BEST SELLER", colors: ["#f2eee6"], isFeatured: true },
  { id: "p3", slug: "corset-alcas-rose", name: "Corset Alças Rosé", category: "Com alças", price: 389.9, installments: 6, image: k.alcasRose, hoverImage: k.alcasPreto, colors: ["#e8c3bb", "var(--foreground)"] },
  { id: "p4", slug: "corset-reto-preto", name: "Corset Reto Preto", category: "Tomara que caia", price: 359.9, installments: 6, image: k.retoPreto, hoverImage: k.tomaraPreto, badge: "EDIÇÃO LIMITADA", colors: ["var(--foreground)"] },
  { id: "p5", slug: "corset-alcas-fendi", name: "Corset Alças Fendi", category: "Com alças", price: 349.9, compareAtPrice: 419.9, installments: 6, image: k.alcasFendi, hoverImage: k.alcasBranco, badge: "BEST SELLER", colors: ["#8f7e68", "#f5f3ef"] },
  { id: "p6", slug: "corset-tomara-jeans", name: "Corset Tomara Jeans", category: "Tomara que caia", price: 369.9, installments: 6, image: k.tomaraJeans, hoverImage: k.retoJeans, colors: ["#4f6f95"] },
  { id: "p7", slug: "corset-cetim-rose", name: "Corset Cetim Rosé", category: "Tomara que caia", price: 399.9, installments: 6, image: k.tomaraRose, hoverImage: k.retoRose, colors: ["#e8c3bb"] },
  { id: "p8", slug: "corset-reto-fendi", name: "Corset Reto Fendi", category: "Tomara que caia", price: 359.9, installments: 6, image: k.retoFendi, hoverImage: k.tomaraFendi, colors: ["#8f7e68"] },
];

export const editorialLooks = [
  { image: k.editorialRose, alt: "Modelo vestindo corset rosé em cenário natural", label: "Corset Rosé", note: "Estrutura delicada, presença marcante." },
  { image: k.editorialRoseDetail, alt: "Detalhe do corset rosé estruturado", label: "Detalhes que moldam", note: "Recortes precisos e acabamento impecável." },
  { image: k.editorialJeansFront, alt: "Modelo vestindo corset jeans com alças", label: "Denim reinventado", note: "A força do jeans em uma nova silhueta." },
  { image: k.editorialJeansBack, alt: "Costas do corset jeans com amarração", label: "Feito para todos os ângulos", note: "Amarração que ajusta e valoriza o corpo." },
] as const;

export const collections = [
  { name: "Essentials", note: "Bases atemporais em preto, off-white e grafite.", image: overbustImage },
  { name: "Signature", note: "As formas que definem o atelier.", image: violetaImage },
  { name: "Romantic", note: "Bordados, tons coral e leveza.", image: romanticImage },
  { name: "Statement", note: "Volume, veludo e presença.", image: heroImage },
  { name: "Custom", note: "Uma peça que só existe uma vez.", image: detailImage },
];

export const process = [
  { step: "01", title: "Escolha o modelo", text: "Parta de uma de nossas silhuetas ou traga a sua referência." },
  { step: "02", title: "Envie suas medidas", text: "Um guia simples para registrar cada proporção do seu corpo." },
  { step: "03", title: "Defina acabamentos", text: "Tecidos, cores, amarração e detalhes escolhidos com a nossa equipe." },
  { step: "04", title: "Receba sua peça", text: "Construída à mão e enviada com cuidado para todo o Brasil. Ajuste gratuito incluso caso necessário." },
];

export const testimonials = [
  { text: "Nunca imaginei que uma peça pudesse me fazer sentir tão eu. O caimento é perfeito, parece que sempre fez parte do meu corpo.", name: "Marina A.", piece: "Corset Aurora" },
  { text: "O atendimento foi tão cuidadoso quanto o acabamento. Recebi meu sob medida para o casamento e me emocionei ao vestir.", name: "Luiza F.", piece: "Custom" },
  { text: "Uso sobre camisas no trabalho e em festas à noite. Estrutura firme, confortável e com uma presença linda.", name: "Carolina M.", piece: "Underbust Essencial" },
  { text: "O veludo violeta é ainda mais bonito pessoalmente. Cada detalhe mostra o quanto a peça foi feita à mão.", name: "Beatriz R.", piece: "Corset Noite Violeta" },
];

export const gallery = [
  { image: heroImage, alt: "Corset de veludo sobre blusa rendada", span: "md:col-span-2 md:row-span-2" },
  { image: violetaImage, alt: "Modelo com corset de veludo violeta", span: "md:row-span-2" },
  { image: detailImage, alt: "Detalhe de ilhoses e amarração de cetim", span: "" },
  { image: auroraImage, alt: "Corset de cetim off-white com fita rosa", span: "" },
  { image: romanticImage, alt: "Corset coral bordado com saia fluida", span: "md:col-span-2" },
  { image: waistImage, alt: "Cinta modeladora preta", span: "" },
];

export const posts = [
  { category: "Guia", title: "Como escolher o corset ideal", excerpt: "Overbust, underbust ou cinta: entenda qual silhueta combina com o seu momento.", date: "12 set 2026", image: overbustImage },
  { category: "Medidas", title: "Como tirar suas medidas", excerpt: "Passo a passo para medir busto, cintura e quadril com precisão em casa.", date: "28 ago 2026", image: detailImage },
  { category: "Moda", title: "Por que o corset voltou?", excerpt: "Da corte à passarela: a peça que atravessou séculos e reinventou a silhueta.", date: "15 ago 2026", image: violetaImage },
  { category: "Cuidados", title: "Como cuidar do seu corset", excerpt: "Limpeza, armazenamento e pequenos hábitos que fazem a peça durar anos.", date: "02 ago 2026", image: auroraImage },
];

export const faq = [
  { q: "Como funciona a produção sob medida?", a: "Você escolhe o modelo, envia suas medidas pelo nosso guia e definimos juntas tecidos e acabamentos. A partir daí, o molde é desenhado exclusivamente para o seu corpo." },
  { q: "Quanto tempo leva?", a: "Peças sob medida levam, em média, de 20 a 30 dias úteis de produção, mais o prazo de envio." },
  { q: "Como escolher meu tamanho?", a: "Não trabalhamos com tamanhos padrão: usamos as suas medidas de busto, cintura e quadril. Nosso guia mostra como medir em poucos minutos." },
  { q: "Posso personalizar?", a: "Sim. Cor, tecido, amarração, alças, bordados e acabamentos podem ser ajustados em qualquer modelo." },
  { q: "Quais formas de pagamento?", a: "Cartão de crédito em até 6x sem juros, Pix e boleto." },
  { q: "Vocês enviam para todo Brasil?", a: "Sim, enviamos para todo o país com código de rastreio e embalagem protegida." },
  { q: "Como funciona a troca?", a: "Peças prontas podem ser trocadas em até 7 dias após o recebimento. Peças sob medida contam com ajuste gratuito caso necessário." },
];

export const footerLinks = [
  { title: "Shop", links: ["Corsets", "Coleções", "Novidades", "Mais vendidos"] },
  { title: "Atendimento", links: ["Contato", "WhatsApp", "Guia de medidas", "Trocas", "FAQ"] },
  { title: "Sobre", links: ["A marca", "Atelier", "Sob medida", "Blog"] },
  { title: "Redes", links: ["Instagram", "TikTok", "Pinterest"] },
];

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const formatPrice = (value: number) => brl.format(value);
