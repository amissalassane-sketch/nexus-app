import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { getPlatformAdminState } from "@/lib/admin/guard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Sign In",
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminLoginPage({ searchParams }: PageProps) {
  // If the user already has an active session and is a verified Platform Admin,
  // redirect immediately to overview.
  const state = await getPlatformAdminState();
  if (state.status === "admin") {
    redirect("/admin/overview");
  }

  const params = await searchParams;
  let errorMsg = "";
  if (params.error === "forbidden" || state.status === "not_admin") {
    errorMsg = "Authenticated account is not a registered Platform Administrator.";
  } else if (typeof params.error === "string") {
    errorMsg = params.error;
  }

  return <AdminLoginForm initialError={errorMsg} />;
}
