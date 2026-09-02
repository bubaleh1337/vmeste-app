import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SupportPage from "@/app/support/page";
import { SUPPORT_DONATION_URL } from "@/lib/config";
import { PublicLanding } from "./PublicLanding";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/i18n/server", () => ({
  getCookieLocale: async () => "ru",
}));

afterEach(cleanup);

function expectSafeDonationLink(link: HTMLElement) {
  expect(link).toHaveAttribute("href", SUPPORT_DONATION_URL);
  expect(link).toHaveAttribute("target", "_blank");
  expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  expect(link).toHaveAttribute("rel", expect.stringContaining("noreferrer"));
}

describe("Buy Me a Coffee links", () => {
  it("shows a safe external support link on the public landing", () => {
    render(<PublicLanding locale="ru" />);

    expectSafeDonationLink(screen.getByRole("link", { name: /Поддержать «Вместе»/ }));
  });

  it("uses the English product name on the English landing", () => {
    render(<PublicLanding locale="en" />);

    expect(screen.getByRole("heading", { level: 1, name: "Together" })).toBeInTheDocument();
    expectSafeDonationLink(screen.getByRole("link", { name: /Support Together/ }));
    expect(screen.queryByText("Вместе")).not.toBeInTheDocument();
    expect(screen.queryByText(/Vmeste/)).not.toBeInTheDocument();
  });

  it("shows the same support link on the help page", async () => {
    render(await SupportPage());

    expectSafeDonationLink(screen.getByRole("link", { name: /Поддержать «Вместе»/ }));
    expect(screen.getByText(/не получает данные карты/i)).toBeInTheDocument();
  });
});
