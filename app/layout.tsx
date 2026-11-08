import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "SosoEstuda | Um passo mais perto da aprovação",
  description: "Sua jornada de estudos para concursos judiciários. Planeje, revise, aprenda com seus erros e celebre cada conquista.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  manifest: "/manifest.webmanifest",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
