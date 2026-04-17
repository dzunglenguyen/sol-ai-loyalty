"use client";

import { useState, useEffect, useRef } from "react";

interface ExplainOfferState {
  explanation: string | null;
  loading: boolean;
  error: boolean;
}

/**
 * Fetches a Qwen-generated explanation for why a specific offer matches the user.
 *
 * @param userId     - The current user's ID
 * @param campaignId - The campaign to explain, or null to idle
 * @returns { explanation, loading, error }
 */
export function useExplainOffer(
  userId: string,
  campaignId: string | null
): ExplainOfferState {
  const [state, setState] = useState<ExplainOfferState>({
    explanation: null,
    loading: false,
    error: false,
  });

  // Track the latest campaignId to detect stale responses
  const latestCampaignId = useRef<string | null>(null);

  useEffect(() => {
    if (!campaignId) {
      setState({ explanation: null, loading: false, error: false });
      return;
    }

    latestCampaignId.current = campaignId;
    const controller = new AbortController();

    setState({ explanation: null, loading: true, error: false });

    const url = `/api/explain-offer?user_id=${encodeURIComponent(userId)}&campaign_id=${encodeURIComponent(campaignId)}`;

    fetch(url, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ explanation: string | null; error?: string }>;
      })
      .then((data) => {
        // Discard if a newer campaignId was requested before this resolved
        if (latestCampaignId.current !== campaignId) return;

        if (data.explanation) {
          setState({ explanation: data.explanation, loading: false, error: false });
        } else {
          setState({ explanation: null, loading: false, error: true });
        }
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        if (latestCampaignId.current !== campaignId) return;
        setState({ explanation: null, loading: false, error: true });
      });

    return () => {
      controller.abort();
    };
  }, [userId, campaignId]);

  return state;
}
