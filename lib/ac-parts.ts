export interface ACPart {
  id: string;
  name: string;
  description: string;
  defaultPrice: number;
  category: "motor" | "cabine" | "frontal" | "conexao";
  position: { x: number; y: number; z: number };
}

export interface SelectedPart {
  id: string;
  quantity: number;
}

export const AC_PARTS: ACPart[] = [
  {
    id: "compressor",
    name: "Compressor",
    description: "Compressor do ar-condicionado — responsável por pressurizar o gás refrigerante",
    defaultPrice: 850,
    category: "motor",
    position: { x: -0.35, y: 0.22, z: 0.55 },
  },
  {
    id: "condensador",
    name: "Condensador",
    description: "Dissipa o calor do gás refrigerante, localizado na frente do radiador",
    defaultPrice: 420,
    category: "frontal",
    position: { x: 0, y: 0.25, z: 0.9 },
  },
  {
    id: "evaporador",
    name: "Evaporador",
    description: "Responsável por resfriar o ar que entra na cabine do veículo",
    defaultPrice: 580,
    category: "cabine",
    position: { x: 0, y: 0.45, z: 0.2 },
  },
  {
    id: "valvula-expansao",
    name: "Válvula de Expansão",
    description: "Controla o fluxo de refrigerante para o evaporador",
    defaultPrice: 220,
    category: "cabine",
    position: { x: 0.2, y: 0.35, z: 0.15 },
  },
  {
    id: "filtro-secador",
    name: "Filtro Secador",
    description: "Filtra impurezas e remove umidade do sistema",
    defaultPrice: 180,
    category: "motor",
    position: { x: -0.25, y: 0.35, z: 0.7 },
  },
  {
    id: "embreagem-compressor",
    name: "Embreagem do Compressor",
    description: "Acoplamento eletromagnético que liga/desliga o compressor",
    defaultPrice: 350,
    category: "motor",
    position: { x: -0.45, y: 0.18, z: 0.5 },
  },
  {
    id: "motor-ventilador",
    name: "Motor do Ventilador (Blower)",
    description: "Ventilador que sopra o ar frio para dentro da cabine",
    defaultPrice: 290,
    category: "cabine",
    position: { x: 0, y: 0.4, z: 0.05 },
  },
  {
    id: "mangueiras",
    name: "Mangueiras / Tubulação",
    description: "Linhas de alta e baixa pressão que conectam os componentes",
    defaultPrice: 260,
    category: "conexao",
    position: { x: -0.15, y: 0.28, z: 0.55 },
  },
  {
    id: "pressostato",
    name: "Pressostato",
    description: "Sensor de pressão que protege o sistema contra sobrecarga",
    defaultPrice: 120,
    category: "motor",
    position: { x: -0.3, y: 0.4, z: 0.6 },
  },
  {
    id: "ventoinha-condensador",
    name: "Ventoinha do Condensador",
    description: "Ventilador auxiliar que ajuda a dissipar calor do condensador",
    defaultPrice: 310,
    category: "frontal",
    position: { x: 0, y: 0.2, z: 0.95 },
  },
  {
    id: "gas-refrigerante",
    name: "Gás Refrigerante (Recarga)",
    description: "Recarga do gás R134a ou R1234yf do sistema",
    defaultPrice: 150,
    category: "conexao",
    position: { x: 0.3, y: 0.28, z: 0.5 },
  },
  {
    id: "painel-controle",
    name: "Painel de Controle A/C",
    description: "Módulo de controle eletrônico do ar-condicionado no painel",
    defaultPrice: 380,
    category: "cabine",
    position: { x: 0, y: 0.5, z: 0.0 },
  },
];

export function getPartById(id: string): ACPart | undefined {
  return AC_PARTS.find((p) => p.id === id);
}

export const CATEGORY_LABELS: Record<ACPart["category"], string> = {
  motor: "Compartimento do Motor",
  cabine: "Cabine / Painel",
  frontal: "Frontal do Veículo",
  conexao: "Conexões / Sistema",
};

export const CATEGORY_COLORS: Record<ACPart["category"], string> = {
  motor: "#ef4444",
  cabine: "#3b82f6",
  frontal: "#22c55e",
  conexao: "#f97316",
};
