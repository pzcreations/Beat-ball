"use client";

import { RefreshCw, WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/** Erro inesperado ou falha de conexão nas telas internas. */
export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Card className="mx-auto mt-8 max-w-md p-6 text-center">
      <div className="mx-auto mb-3 grid size-11 place-items-center rounded-full bg-azure-50 text-navy-700">
        <WifiOff className="size-5" aria-hidden />
      </div>
      <h1 className="text-lg font-semibold text-navy-900">Não foi possível carregar</h1>
      <p className="mt-1 text-sm text-muted">
        Verifique sua conexão com a internet e tente novamente. Se o problema continuar, avise o gestor.
      </p>
      <Button className="mt-5" onClick={() => reset()}>
        <RefreshCw aria-hidden /> Tentar novamente
      </Button>
    </Card>
  );
}
