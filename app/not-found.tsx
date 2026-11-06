import { BrandMark } from "@/components/brand";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="conteudo" className="grid min-h-dvh place-items-center bg-white px-6">
      <div className="max-w-sm text-center">
        <BrandMark className="mx-auto size-10" />
        <p className="mt-6 text-sm font-medium text-subtle">Erro 404</p>
        <h1 className="mt-1 text-xl font-semibold text-navy-900">Página não encontrada</h1>
        <p className="mt-2 text-sm text-muted">O endereço acessado não existe ou o registro foi removido.</p>
        <ButtonLink href="/" className="mt-6">
          Voltar ao início
        </ButtonLink>
      </div>
    </main>
  );
}
