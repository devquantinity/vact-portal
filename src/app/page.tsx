import { redirect } from "next/navigation";
import { getSessionUser, roleHome } from "@/lib/auth/require";

export default async function Home() {
  const user = await getSessionUser();
  redirect(user ? roleHome(user.role) : "/login");
}
