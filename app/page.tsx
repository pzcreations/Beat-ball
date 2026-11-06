import { redirect } from "next/navigation";

import { homePathFor, requireUser } from "@/lib/auth";

/** Direciona cada perfil para sua página inicial. */
export default async function Home() {
  const user = await requireUser();
  redirect(homePathFor(user));
}
