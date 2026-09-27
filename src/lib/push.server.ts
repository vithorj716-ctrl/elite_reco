/**
 * Núcleo do envio de Web Push (VAPID) — executa apenas no servidor.
 *
 * Chamado por:
 *  • src/routes/api/public/push/despachar.ts — acionado pelo próprio banco
 *    (gatilho + pg_net) assim que uma notificação é criada. É este caminho que
 *    faz o aviso chegar com o aplicativo fechado.
 *  • src/lib/push.functions.ts — despacho manual/diagnóstico pela central.
 *
 * A chave privada VAPID nunca sai daqui.
 */

type Aviso = {
  id: string;
  usuario_id: string;
  titulo: string;
  mensagem: string;
  tipo: string;
  ordem_id: string | null;
  vistoria_id: string | null;
  dados: unknown;
};

export type ResultadoDespacho = {
  avisos: number;
  enviadas: number;
  falhas: number;
  desativadas: number;
  motivo?: string;
};

function decodificarBase64Url(valor: string): Uint8Array {
  const limpo = valor.trim().replace(/-/g, "+").replace(/_/g, "/");
  const preenchido = limpo.padEnd(limpo.length + ((4 - (limpo.length % 4)) % 4), "=");
  const binario = atob(preenchido);
  return Uint8Array.from(binario, (caractere) => caractere.charCodeAt(0));
}

function codificarBase64Url(valor: Uint8Array): string {
  let binario = "";
  for (const byte of valor) binario += String.fromCharCode(byte);
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function carregarChavesVapid(publicKey: string, privateKey: string) {
  const { ApplicationServerKeys } = await import("webpush-webcrypto");
  const privada = decodificarBase64Url(privateKey);

  // Geradores VAPID normalmente exportam o escalar privado de 32 bytes.
  // A biblioteca espera PKCS#8, então importamos o mesmo par como JWK sem
  // invalidar a chave pública já usada pelos aparelhos inscritos.
  if (privada.byteLength === 32) {
    const publica = decodificarBase64Url(publicKey);
    if (publica.byteLength !== 65 || publica[0] !== 4) {
      throw new Error("Chave pública VAPID inválida");
    }
    const x = codificarBase64Url(publica.slice(1, 33));
    const y = codificarBase64Url(publica.slice(33, 65));
    const d = codificarBase64Url(privada);
    const algoritmo = { name: "ECDSA", namedCurve: "P-256" } as const;
    const [publicaCrypto, privadaCrypto] = await Promise.all([
      crypto.subtle.importKey("jwk", { kty: "EC", crv: "P-256", x, y, ext: true }, algoritmo, true, []),
      crypto.subtle.importKey(
        "jwk",
        { kty: "EC", crv: "P-256", x, y, d, ext: true },
        algoritmo,
        true,
        ["sign"],
      ),
    ]);
    return new ApplicationServerKeys(publicaCrypto, privadaCrypto);
  }

  return ApplicationServerKeys.fromJSON({ publicKey, privateKey });
}

/** Rota que o clique na notificação deve abrir, conforme o papel do usuário. */
async function destinoDoAviso(
  supabaseAdmin: {
    from: (t: string) => {
      select: (c: string) => {
        eq: (
          c: string,
          v: string,
        ) => { maybeSingle: () => Promise<{ data: { agente_id: string | null } | null }> };
      };
    };
  },
  aviso: Aviso,
): Promise<string> {
  if (!aviso.ordem_id && !aviso.vistoria_id) return "/";
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("agente_id")
    .eq("id", aviso.usuario_id)
    .maybeSingle();
  const agente = Boolean(data?.agente_id);
  if (aviso.ordem_id) return agente ? `/agente/${aviso.ordem_id}` : `/ordens/${aviso.ordem_id}`;
  return agente ? "/agente/vistorias" : `/vistorias/${aviso.vistoria_id}`;
}

/**
 * Entrega os avisos pendentes. Quando `notificacaoId` é informado, entrega
 * apenas aquele aviso (caminho do gatilho do banco).
 */
export async function despacharAvisos(notificacaoId?: string): Promise<ResultadoDespacho> {
  const publicKey = process.env["VAPID_PUBLIC_KEY"];
  const privateKey = process.env["VAPID_PRIVATE_KEY"];
  const vazio: ResultadoDespacho = { avisos: 0, enviadas: 0, falhas: 0, desativadas: 0 };
  if (!publicKey || !privateKey) return { ...vazio, motivo: "sem chaves VAPID" };

  // Valida antes de reservar avisos. Uma configuração inválida não pode marcar
  // a notificação como entregue antes de qualquer tentativa real de envio.
  const chaves = await carregarChavesVapid(publicKey, privateKey);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let consulta = supabaseAdmin
    .from("notificacoes")
    .select("id, usuario_id, titulo, mensagem, tipo, ordem_id, vistoria_id, dados")
    .is("entregue_em", null);

  consulta = notificacaoId
    ? consulta.eq("id", notificacaoId)
    : consulta.order("criada_em", { ascending: true }).limit(50);

  const { data: pendentes } = await consulta;
  if (!pendentes || pendentes.length === 0) return vazio;

  const avisos = pendentes as unknown as Aviso[];
  const usuarios = [...new Set(avisos.map((n) => n.usuario_id))];
  const { data: inscricoes } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, usuario_id, endpoint, p256dh, auth")
    .in("usuario_id", usuarios)
    .eq("ativo", true);

  const usuariosInscritos = new Set((inscricoes ?? []).map((inscricao) => inscricao.usuario_id));
  const entregaveis = avisos.filter((aviso) => usuariosInscritos.has(aviso.usuario_id));
  if (entregaveis.length === 0) {
    return { ...vazio, motivo: "nenhum aparelho ativo para os avisos pendentes" };
  }

  const { generatePushHTTPRequest } = await import("webpush-webcrypto");
  const contato = process.env["VAPID_SUBJECT"] || "mailto:operacao@recolhe.app";

  const registros: Array<{
    notification_id: string;
    subscription_id: string;
    usuario_id: string;
    status: string;
    erro: string;
  }> = [];
  const desativar: Array<{ id: string; erro: string }> = [];
  const avisosEntregues = new Set<string>();
  let enviadas = 0;
  let falhas = 0;

  for (const aviso of entregaveis) {
    const alvos = (inscricoes ?? []).filter((s) => s.usuario_id === aviso.usuario_id);
    if (alvos.length === 0) continue;
    const url = await destinoDoAviso(supabaseAdmin as never, aviso);

    for (const alvo of alvos) {
      try {
        const { headers, body, endpoint } = await generatePushHTTPRequest({
          applicationServerKeys: chaves,
          payload: JSON.stringify({
            eventId: aviso.id,
            titulo: aviso.titulo,
            mensagem: aviso.mensagem,
            tipo: aviso.tipo,
            ordemId: aviso.ordem_id,
            url,
          }),
          target: {
            endpoint: alvo.endpoint,
            keys: { p256dh: alvo.p256dh, auth: alvo.auth },
          },
          adminContact: contato,
          ttl: 60 * 60 * 12,
          urgency: "high",
        });
        const resposta = await fetch(endpoint, { method: "POST", headers, body });

        if (resposta.status === 404 || resposta.status === 410) {
          desativar.push({ id: alvo.id, erro: `inscrição expirada (${resposta.status})` });
          falhas += 1;
          registros.push({
            notification_id: aviso.id,
            subscription_id: alvo.id,
            usuario_id: aviso.usuario_id,
            status: "expirada",
            erro: String(resposta.status),
          });
        } else if (resposta.ok) {
          enviadas += 1;
          avisosEntregues.add(aviso.id);
          registros.push({
            notification_id: aviso.id,
            subscription_id: alvo.id,
            usuario_id: aviso.usuario_id,
            status: "enviado",
            erro: "",
          });
        } else {
          falhas += 1;
          const texto = await resposta.text().catch(() => "");
          registros.push({
            notification_id: aviso.id,
            subscription_id: alvo.id,
            usuario_id: aviso.usuario_id,
            status: "falha",
            erro: `${resposta.status} ${texto}`.slice(0, 400),
          });
        }
      } catch (e) {
        falhas += 1;
        registros.push({
          notification_id: aviso.id,
          subscription_id: alvo.id,
          usuario_id: aviso.usuario_id,
          status: "erro",
          erro: String((e as Error).message ?? e).slice(0, 400),
        });
      }
    }
  }

  if (registros.length > 0) {
    await supabaseAdmin.from("push_notification_logs").insert(registros);
    const agora = new Date().toISOString();
    const ok = [...new Set(registros.filter((r) => r.status === "enviado").map((r) => r.subscription_id))];
    if (ok.length > 0) {
      await supabaseAdmin
        .from("push_subscriptions")
        .update({ ultimo_envio_em: agora, ultimo_erro: "" })
        .in("id", ok);
    }
  }

  // Só conclui a notificação depois que ao menos um aparelho confirmou o
  // recebimento. Falhas temporárias permanecem na fila para a retentativa.
  if (avisosEntregues.size > 0) {
    await supabaseAdmin
      .from("notificacoes")
      .update({ entregue_em: new Date().toISOString() })
      .in("id", [...avisosEntregues]);
  }

  for (const morta of desativar) {
    await supabaseAdmin
      .from("push_subscriptions")
      .update({ ativo: false, ultimo_erro: morta.erro })
      .eq("id", morta.id);
  }

  return {
    avisos: entregaveis.length,
    enviadas,
    falhas,
    desativadas: desativar.length,
  };
}
