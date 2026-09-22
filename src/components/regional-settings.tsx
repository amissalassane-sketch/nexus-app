"use client";
import { useEffect, useState } from "react";
import { COUNTRIES } from "@/lib/global/country";
import { LOCALES } from "@/lib/global/locale";
import { CURRENCIES, formatMoney } from "@/lib/global/currency";
import { DEFAULT_USER_CONTEXT, parseUserContext, type UserRegionalContext } from "@/lib/global/context";
import { formatDateOnly, formatInstant, formatNumber } from "@/lib/global/formatting";
import { Button } from "@/components/ui/button";
import { ThemeControl } from "@/components/theme-control";
const control = "mt-1 min-h-11 w-full rounded-input border border-border-strong bg-bg-surface px-3 text-text-primary";
export function RegionalSettings() {
  const [form, setForm] = useState<UserRegionalContext>(DEFAULT_USER_CONTEXT);
  const [busy, setBusy] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/settings/regional", { cache: "no-store", signal: controller.signal }).then(async r => { if (!r.ok) throw new Error(); const data = await r.json(); setForm(parseUserContext(data.context)); setLoaded(true); }).catch(e => { if (e.name !== "AbortError") setError("Your regional preferences could not be loaded. Reload to retry. The migration may not be installed."); }).finally(() => setBusy(false));
    return () => controller.abort();
  }, []);
  let preview: UserRegionalContext | null = null;
  try { preview = parseUserContext(form); } catch { /* input may be incomplete */ }
  function field(key: keyof UserRegionalContext, value: string | number | null) { setForm(f => ({ ...f, [key]: value })); setMessage(""); }
  async function save() {
    if (!preview) return;
    setBusy(true); setError(""); setMessage("");
    try { const r = await fetch("/api/settings/regional", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(preview) }); if (!r.ok) throw new Error(); setMessage("Preferences saved. Your workspace legal country has not changed."); }
    catch { setError("Preferences were not saved. Please retry."); } finally { setBusy(false); }
  }
  return <div className="space-y-6"><section className="rounded-card border border-border-default bg-bg-surface p-5 space-y-3"><h2 className="text-lg font-medium">Appearance</h2><ThemeControl /><p className="text-text-secondary">Saved in this browser only. Light mode is new and still needs authenticated-screen accessibility review.</p></section>
    <form className="rounded-card border border-border-default bg-bg-surface p-5 space-y-5" onSubmit={e => { e.preventDefault(); void save(); }}>
      <h2 className="text-lg font-medium">Your regional preferences</h2><p className="text-text-secondary">These settings are saved to your profile preferences and used in the preview below. Other screens have not all adopted them yet. No automatic location detection or legal-country update occurs.</p>
      {error && <p role="alert" className="text-danger">{error}</p>}{message && <p role="status" className="text-success">{message}</p>}
      <fieldset disabled={busy || !loaded} className="grid gap-4 sm:grid-cols-2">
        <label>Country (display preference)<select className={control} value={form.country ?? ""} onChange={e => field("country", e.target.value || null)}><option value="">Not specified</option>{COUNTRIES.map(c => <option key={c}>{c}</option>)}</select></label>
        <label>Formatting locale<select className={control} value={form.locale} onChange={e => field("locale", e.target.value)}>{LOCALES.map(c => <option key={c}>{c}</option>)}</select></label>
        <label>Timezone (IANA)<input className={control} value={form.timezone} onChange={e => field("timezone", e.target.value)} list="timezones" required aria-describedby="timezone-help" /><datalist id="timezones">{["UTC", "Africa/Porto-Novo", "Africa/Lagos", "Europe/Paris", "America/New_York", "Asia/Tokyo"].map(t => <option key={t}>{t}</option>)}</datalist><span id="timezone-help" className="text-small text-text-secondary">For Cotonou use Africa/Porto-Novo.</span></label>
        <label>Display currency<select className={control} value={form.currency} onChange={e => field("currency", e.target.value)}>{Object.keys(CURRENCIES).map(c => <option key={c}>{c}</option>)}</select></label>
        <label>Date format<select className={control} value={form.dateFormat} onChange={e => field("dateFormat", e.target.value)}><option value="locale">Locale default</option><option value="iso">YYYY-MM-DD (dates only)</option></select></label>
        <label>Number format<select className={control} value={form.numberFormat} onChange={e => field("numberFormat", e.target.value)}><option value="locale">Locale default</option><option value="latin">Latin digits</option></select></label>
        <label>Week starts<select className={control} value={form.weekStart} onChange={e => field("weekStart", Number(e.target.value))}><option value="1">Monday</option><option value="0">Sunday</option></select></label>
        <label>Measurement system<select className={control} value={form.measurementSystem} onChange={e => field("measurementSystem", e.target.value)}><option value="metric">Metric</option><option value="us">US customary</option></select></label>
      </fieldset>
      <div className="rounded-input bg-bg-surface-2 p-4 text-text-secondary" aria-live="polite">{preview ? <><p>Example instant: {formatInstant("2026-09-22T12:00:00Z", preview)}</p><p>Example date: {formatDateOnly("2026-09-22", preview)}</p><p>Example number: {formatNumber(12345.67, preview)}</p><p>Example amount: {formatMoney({ amountMinor: 12345, currency: preview.currency }, preview.locale)} (not a price or exchange-rate quote)</p></> : <p>Enter a valid IANA timezone and supported preferences.</p>}</div>
      <Button type="submit" disabled={!preview || busy || !loaded}>{busy ? "Loading…" : "Save preferences"}</Button>
    </form>
  </div>;
}
