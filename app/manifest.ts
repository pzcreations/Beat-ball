import type { MetadataRoute } from "next";

/** Web App Manifest — permite instalar o Recepção na tela inicial. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Recepção",
    short_name: "Recepção",
    description: "Sistema de recepção e cadastro de pessoas.",
    lang: "pt-BR",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Novo cadastro",
        short_name: "Cadastrar",
        url: "/cadastrar",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
