// app/(marketing)/upgrade or app/upgrade/page.tsx
import { Button } from "@/components/ui/button"

export default function UpgradePage() {
  return (
    <div className="relative min-h-screen bg-[#0A0A0A] px-4 py-20">
      {/* Radial glow lavender */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(233,228,255,0.18)_0%,transparent_70%)] blur-[40px]" />

      <div className="relative mx-auto max-w-[960px]">
        <div className="mb-16 text-center">
          <span className="mb-4 inline-flex rounded-full bg-[rgba(233,228,255,0.12)] px-3 py-1 text-[11px] font-[500] tracking-[0.06em] text-[#E9E4FF]">Upgrade</span>
          <h1 className="text-[32px] font-[500] tracking-[-0.03em] text-[#F5F5F5]">Build your system without limits</h1>
          <p className="mx-auto mt-2 max-w-[480px] text-[15px] text-[#8F8F8F]">Simple pricing for unlimited possibilities.</p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {[
            { name: "Hobby", price: "$0", sub: "/ mo", desc: "Get started with fundamental features.", features: ["1 Project, 5 Team Members", "Limited API Access", "Community Support"], cta: "Get Started", featured: false },
            { name: "Pro", price: "$49", sub: "/ mo per user", desc: "Scale production systems.", features: ["10 Projects, 50 Team Members", "Standard API Access", "Priority Email Support", "Advanced Analytics"], cta: "Start Pro Trial", featured: true },
            { name: "Enterprise", price: "Contact Sales", sub: "", desc: "Tailored solutions for large organizations.", features: ["Unlimited Projects", "Unlimited Members", "Premium API Access", "Dedicated Support Manager", "Single Sign-On (SSO)."], cta: "Contact Sales", featured: false },
          ].map(card => (
            <div key={card.name} className={`flex flex-col rounded-[24px] border bg-[#111111] p-7 ${card.featured ? "border-[rgba(233,228,255,0.24)] shadow-[0_0_0_1px_rgba(233,228,255,0.12)]" : "border-[rgba(255,255,255,0.08)]"}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-[16px] font-[550] text-[#F5F5F5]">{card.name}</h3>
                {card.featured && <span className="rounded-full bg-[rgba(255,255,255,0.08)] px-2 py-0.5 text-[11px] text-[#8F8F8F]">featured</span>}
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-[28px] font-[600] tracking-[-0.02em] text-[#F5F5F5]">{card.price}</span>
                <span className="text-[13px] text-[#8F8F8F]">{card.sub}</span>
              </div>
              <p className="mt-2 text-[13px] text-[#8F8F8F]">{card.desc}</p>
              <div className="mt-6 flex flex-col gap-2.5">
                {card.features.map(f => (
                  <div key={f} className="flex items-center gap-2 text-[13px] text-[#8F8F8F]">
                    <div className="h-4 w-4 rounded-full bg-[rgba(255,255,255,0.06)]" />
                    {f}
                  </div>
                ))}
              </div>
              <Button className="mt-auto pt-6 w-full rounded-full" variant="default">{card.cta}</Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
