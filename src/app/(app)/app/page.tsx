import { redirect } from "next/navigation";

/** Canonical authenticated product entry point. */
export default function AppPage() {
  redirect("/dashboard");
}
