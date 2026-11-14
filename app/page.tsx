"use client";

import { useState } from "react";
import { CarViewer } from "@/components/car-viewer/car-viewer";
import { QuotePanel } from "@/components/orcamento/quote-panel";
import { Header } from "@/components/layout/header";
import type { SelectedPart } from "@/lib/ac-parts";

export default function Home() {
  const [selectedParts, setSelectedParts] = useState<SelectedPart[]>([]);

  function handlePartToggle(partId: string) {
    setSelectedParts((prev) => {
      const exists = prev.find((p) => p.id === partId);
      if (exists) return prev.filter((p) => p.id !== partId);
      return [...prev, { id: partId, quantity: 1 }];
    });
  }

  function handlePartQuantity(partId: string, quantity: number) {
    setSelectedParts((prev) =>
      prev.map((p) => (p.id === partId ? { ...p, quantity } : p))
    );
  }

  function handleClearParts() {
    setSelectedParts([]);
  }

  return (
    <div className="min-h-screen bg-dark-950">
      <Header />
      <main className="px-4 pb-8 pt-4 lg:px-8">
        <div className="mx-auto max-w-[1600px]">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_480px]">
            <CarViewer
              selectedParts={selectedParts}
              onPartToggle={handlePartToggle}
            />
            <QuotePanel
              selectedParts={selectedParts}
              onPartQuantity={handlePartQuantity}
              onPartToggle={handlePartToggle}
              onClearParts={handleClearParts}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
