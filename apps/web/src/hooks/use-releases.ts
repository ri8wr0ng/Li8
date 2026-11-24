import { useEffect, useState } from "react";
import { RELEASES_URL, isReleaseList, parseReleases, type Build } from "#/lib/releases";

export type ReleasesState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; builds: Build[] };

/** Every published mobile build, fetched once from GitHub releases. */
export function useReleases(): ReleasesState {
  const [state, setState] = useState<ReleasesState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch(RELEASES_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`GitHub releases responded ${response.status}`);
        return response.json();
      })
      .then((data: unknown) => {
        if (cancelled) return;
        setState(
          isReleaseList(data)
            ? { status: "ready", builds: parseReleases(data) }
            : { status: "error" },
        );
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
