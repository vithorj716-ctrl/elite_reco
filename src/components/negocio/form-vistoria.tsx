/**
 * Formulário único da solicitação de vistoria — usado na abertura pela central,
 * na solicitação da locadora e na edição posterior. Os mesmos campos
 * operacionais do recolhimento: contato, endereço completo e rastreador.
 */
import { Entrada, Grade, AreaTexto } from "@/components/negocio/formulario";
import type { DadosVistoria } from "@/services/vistorias.service";

export interface FormularioVistoria extends DadosVistoria {
  observacoes: string;
  contatoNome: string;
  contatoTelefone: string;
  contatoEmail: string;
  endereco: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  linkMaps: string;
  host: string;
  pin: string;
  pinValidade: string;
}

export const VISTORIA_VAZIA: FormularioVistoria = {
  observacoes: "",
  contatoNome: "",
  contatoTelefone: "",
  contatoEmail: "",
  endereco: "",
  bairro: "",
  cidade: "",
  uf: "",
  cep: "",
  linkMaps: "",
  host: "",
  pin: "",
  pinValidade: "",
};

interface Props {
  valor: FormularioVistoria;
  aoAlterar: (mudanca: Partial<FormularioVistoria>) => void;
}

/** Blocos de contato, endereço e rastreador da vistoria. */
export function CamposVistoria({ valor, aoAlterar }: Props) {
  const campo = (chave: keyof FormularioVistoria) => ({
    value: valor[chave] ?? "",
    onChange: (e: { target: { value: string } }) => aoAlterar({ [chave]: e.target.value }),
  });

  return (
    <div className="grid gap-5">
      <section>
        <h3 className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
          Contato no local
        </h3>
        <Grade colunas={3}>
          <Entrada rotulo="Nome do contato" {...campo("contatoNome")} />
          <Entrada rotulo="Telefone" placeholder="(00) 00000-0000" {...campo("contatoTelefone")} />
          <Entrada rotulo="E-mail" {...campo("contatoEmail")} />
        </Grade>
      </section>

      <section>
        <h3 className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
          Endereço da vistoria
        </h3>
        <Grade colunas={3}>
          <Entrada rotulo="CEP" {...campo("cep")} />
          <Entrada rotulo="Endereço" areaClassName="sm:col-span-2" {...campo("endereco")} />
          <Entrada rotulo="Bairro" {...campo("bairro")} />
          <Entrada rotulo="Cidade" {...campo("cidade")} />
          <Entrada rotulo="UF" maxLength={2} {...campo("uf")} />
          <Entrada
            rotulo="Link do mapa"
            areaClassName="sm:col-span-3"
            placeholder="https://maps.google.com/..."
            {...campo("linkMaps")}
          />
        </Grade>
      </section>

      <section>
        <h3 className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
          Rastreador
        </h3>
        <Grade colunas={3}>
          <Entrada rotulo="Host / plataforma" {...campo("host")} />
          <Entrada rotulo="PIN de acesso" {...campo("pin")} />
          <Entrada rotulo="Validade do PIN" {...campo("pinValidade")} />
        </Grade>
      </section>

      <AreaTexto rotulo="Observações" rows={3} {...campo("observacoes")} />
    </div>
  );
}
