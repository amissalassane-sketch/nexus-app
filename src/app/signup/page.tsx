"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { NexusLogo } from "@/components/nexus-logo";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setMessage("");

    const cleanFullName = fullName.trim();
    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanFullName) {
      setError("Please enter your full name.");
      setLoading(false);
      return;
    }

    if (!cleanUsername) {
      setError("Please choose a username.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          full_name: cleanFullName,
          username: cleanUsername,
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setMessage(
      "Account created. Check your email if confirmation is required."
    );

    setTimeout(() => {
      router.push("/login");
    }, 1500);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-base px-5 py-10 text-text-primary">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex justify-center text-text-primary">
            <NexusLogo size={40} />
          </div>

          <h1 className="text-h1 font-semibold">
            Create your NEXUS
          </h1>

          <p className="mt-2 text-small text-text-secondary">
            Start building your personal operating system.
          </p>
        </div>

        <div className="rounded-xl border border-border-default bg-bg-surface p-6 shadow-md">
          <form onSubmit={handleSignup} className="space-y-5">
            <div>
              <label className="mb-2 block text-label text-text-secondary">
                Full name
              </label>

              <input
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Your full name"
                required
                className="w-full min-h-11 rounded-md border border-border-default bg-bg-subtle px-3 text-body text-text-primary outline-none transition-all duration-[160ms] ease-out placeholder:text-text-quaternary focus:border-border-focus"
              />
            </div>

            <div>
              <label className="mb-2 block text-label text-text-secondary">
                Username
              </label>

              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="yourusername"
                required
                minLength={3}
                maxLength={30}
                pattern="[A-Za-z0-9_]+"
                title="Username can only contain letters, numbers and underscores."
                className="w-full min-h-11 rounded-md border border-border-default bg-bg-subtle px-3 text-body text-text-primary outline-none transition-all duration-[160ms] ease-out placeholder:text-text-quaternary focus:border-border-focus"
              />
            </div>

            <div>
              <label className="mb-2 block text-label text-text-secondary">
                Email
              </label>

              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
                className="w-full min-h-11 rounded-md border border-border-default bg-bg-subtle px-3 text-body text-text-primary outline-none transition-all duration-[160ms] ease-out placeholder:text-text-quaternary focus:border-border-focus"
              />
            </div>

            <div>
              <label className="mb-2 block text-label text-text-secondary">
                Password
              </label>

              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Minimum 6 characters"
                minLength={6}
                required
                className="w-full min-h-11 rounded-md border border-border-default bg-bg-subtle px-3 text-body text-text-primary outline-none transition-all duration-[160ms] ease-out placeholder:text-text-quaternary focus:border-border-focus"
              />
            </div>

            {error && (
              <div className="animate-fade-in rounded-md border border-danger-border bg-danger-bg px-4 py-3 text-small text-danger-fg">
                {error}
              </div>
            )}

            {message && (
              <div className="animate-fade-in rounded-md border border-success-border bg-success-bg px-4 py-3 text-small text-success-fg">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-11 rounded-md bg-accent-primary px-4 py-3 text-button font-medium text-accent-primary-fg transition-all duration-[120ms] ease-out hover:bg-accent-primary-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:border disabled:border-white/10 disabled:bg-transparent disabled:text-text-tertiary"
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-small text-text-secondary">
            Already have an account?{" "}
            <a
              href="/login"
              className="text-text-primary underline decoration-border-strong underline-offset-4 transition-colors duration-[120ms] hover:decoration-text-primary"
            >
              Sign in
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
