import { getProvider } from "../integrations/providers";
export function integrationAvailability(providerId: string) {
  const provider = getProvider(providerId);
  return { registered: Boolean(provider), dataAdapterImplemented: provider?.capabilities.some(c => c.adapter === "implemented") ?? false,
    connected: null, verified: false, regionalReview: "HUMAN_ACTION_REQUIRED" as const };
}
