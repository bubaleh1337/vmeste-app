import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthSessionKeeper } from "./AuthSessionKeeper";

const refresh = vi.fn();
const getSession = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("@/lib/supabase/config", () => ({
  isSupabaseConfigured: () => true,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { getSession } }),
}));

afterEach(() => {
  cleanup();
  refresh.mockReset();
  getSession.mockReset();
});

describe("AuthSessionKeeper", () => {
  it("recovers a persisted session when the PWA starts", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "fresh" } }, error: null });

    render(<AuthSessionKeeper />);

    await waitFor(() => expect(getSession).toHaveBeenCalledTimes(1));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("rechecks the session when an installed app returns to the foreground", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "fresh" } }, error: null });
    render(<AuthSessionKeeper />);
    await waitFor(() => expect(getSession).toHaveBeenCalledTimes(1));

    document.dispatchEvent(new Event("visibilitychange"));

    await waitFor(() => expect(getSession).toHaveBeenCalledTimes(2));
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("does not refresh the page when there is no persisted session", async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: null });

    render(<AuthSessionKeeper />);

    await waitFor(() => expect(getSession).toHaveBeenCalledTimes(1));
    expect(refresh).not.toHaveBeenCalled();
  });
});
