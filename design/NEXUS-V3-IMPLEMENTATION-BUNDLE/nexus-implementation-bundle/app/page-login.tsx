// app/(auth)/login/page.tsx - Login V3
import Image from "next/image"
import { Button } from "@/components/ui/button"

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0A0A] p-4">
      <div className="w-full max-w-[400px] rounded-[24px] border border-[rgba(255,255,255,0.08)] bg-[#111111] p-8 shadow-[0_16px_40px_rgba(0,0,0,0.48)]">
        <div className="mb-8 flex flex-col items-center">
          <Image src="/logo/nexus.png" alt="NEXUS" width={48} height={48} className="mb-6 h-12 w-12" />
          <h1 className="text-[20px] font-[550] tracking-[-0.02em] text-[#F5F5F5]">Sign in to Nexus</h1>
          <p className="mt-1 text-[13px] text-[#8F8F8F]">Enter your details to access your workspace.</p>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-[12px] font-[500] text-[#8F8F8F]">Email Address</label>
            <input className="h-11 w-full rounded-[10px] border border-[rgba(255,255,255,0.08)] bg-[#171717] px-3 text-[13.5px] text-[#F5F5F5] placeholder:text-[#3A3A3A] focus:border-[rgba(255,255,255,0.16)] focus:outline-none" placeholder="you@example.com" />
          </div>
          <div>
            <div className="mb-1.5 flex justify-between">
              <label className="text-[12px] font-[500] text-[#8F8F8F]">Password</label>
              <span className="text-[12px] text-[#8F8F8F] hover:text-[#F5F5F5] cursor-pointer">Forgot password?</span>
            </div>
            <input type="password" className="h-11 w-full rounded-[10px] border border-[rgba(255,255,255,0.08)] bg-[#171717] px-3 text-[13.5px] focus:border-[rgba(255,255,255,0.16)] focus:outline-none" placeholder="••••••••••••" />
          </div>
          <Button variant="default" size="lg" className="mt-2 w-full rounded-full">Sign In</Button>

          <div className="my-2 flex items-center gap-3">
            <div className="h-px flex-1 bg-[rgba(255,255,255,0.06)]" />
            <span className="font-mono text-[11px] uppercase text-[#5A5A5A]">OR</span>
            <div className="h-px flex-1 bg-[rgba(255,255,255,0.06)]" />
          </div>

          <Button variant="secondary" className="w-full justify-center">Continue with Google</Button>
          <Button variant="secondary" className="w-full justify-center">Continue with GitHub</Button>
        </div>

        <p className="mt-6 text-center text-[12.5px] text-[#8F8F8F]">
          Don't have an account? <span className="text-[#F5F5F5] underline">Create one for free</span>
        </p>
      </div>
    </div>
  )
}
