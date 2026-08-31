import { expect, test } from "@playwright/test";

test("demo flow keeps savings independent from expenses", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Квартира" })).toBeVisible();

  await page.getByRole("button", { name: "Накопления", exact: true }).first().click();
  const balanceBefore = await page.getByTestId("savings-balance").textContent();

  await page.getByRole("button", { name: "Расходы", exact: true }).first().click();
  await page.getByLabel("Сумма, ₸").fill("12345");
  await page.getByLabel("Описание").fill("Тестовый расход");
  await page.getByLabel("Категория").selectOption({ label: "Развлечения" });
  await page.getByRole("button", { name: "Добавить расход", exact: true }).last().click();
  await expect(page.getByText("Тестовый расход")).toBeVisible();

  await page.getByRole("button", { name: "Накопления", exact: true }).first().click();
  await expect(page.getByTestId("savings-balance")).toHaveText(balanceBefore ?? "");
});
