"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { NexusLogo } from "@/components/nexus-logo";
import { Field, Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";

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

    setMessage("Account created. Check your email if confirmation is required.");

    setTimeout(() => {
      router.push("/login");
    }, 1500);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-base px-4 py-10">
      <div className="w-full max-w-[400px] rounded-auth border border-border-default bg-bg-subtle p-8 shadow-auth">
        <div className="mb-7 flex flex-col items-center text-center">
          <NexusLogo size={48} priority className="mb-5" />
          <h1 className="text-h1 text-text-primary">Create your NEXUS</h1>
          <p className="mt-1 text-small text-text-secondary">
            Start building your personal operating system.
          </p>
        </div>

        <form onSubmit={handleSignup} className="flex flex-col gap-4">
          <Field label="Full name" htmlFor="signup-name">
            <Input
              id="signup-name"
              size="lg"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Your full name"
              autoComplete="name"
              required
            />
          </Field>

          <Field label="Username" htmlFor="signup-username">
            <Input
              id="signup-username"
              size="lg"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="yourusername"
              minLength={3}
              maxLength={30}
              pattern="[A-Za-z0-9_]+"
              title="Username can only contain letters, numbers and underscores."
              autoComplete="username"
              required
            />
          </Field>

          <Field label="Email" htmlFor="signup-email">
            <Input
              id="signup-email"
              size="lg"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </Field>

          <Field label="Password" htmlFor="signup-password">
            <Input
              id="signup-password"
              size="lg"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Minimum 6 characters"
              minLength={6}
              autoComplete="new-password"
              required
            />
          </Field>

          {error ? <Alert tone="danger">{error}</Alert> : null}
          {message ? <Alert tone="success">{message}</Alert> : null}

          <Button type="submit" size="lg" disabled={loading} className="mt-1 w-full">
            {loading ? "Creating account..." : "Create account"}
          </Button>
        </form>

        <p className="mt-6 text-center text-small text-text-secondary">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-text-primary underline decoration-border-strong underline-offset-4 transition-colors hover:decoration-text-primary"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
