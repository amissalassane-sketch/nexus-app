import { redirect } from "next/navigation";
import { ADMIN_HOME } from "@/lib/admin/nav";

/**
 * /admin has no content of its own. It exists so that the URL an operator
 * types resolves somewhere real instead of 404-ing, and so the gate in
 * ./layout.tsx is exercised before the redirect happens — a signed-in
 * customer who guesses /admin still gets the refusal screen, not a peek
 * at where the overview lives.
 */
export default function AdminIndexPage() {
  redirect(ADMIN_HOME);
}
