import { test, expect } from "@playwright/test";
test("host creates a celebration, guest RSVPs, dashboard reflects the RSVP", async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Bring your people together." })).toBeVisible();
  await page.getByRole("button", { name: "Create your first party" }).click();
  await page.getByPlaceholder("e.g. Rooftop birthday bash").fill("Playwright Birthday");
  await page.locator('input[type="date"]').fill("2030-12-31");
  await page.getByPlaceholder("Address, venue or 'My place'").fill("Mumbai");
  await page.getByRole("button", { name: "Create celebration" }).click();
  await expect(page.getByRole("heading", { name: "Playwright Birthday" })).toBeVisible();
  await page.getByRole("link", { name: "Open guest page" }).click();
  console.log("invite-debug", page.url(), await page.evaluate(() => localStorage.getItem("partyhub.demo.parties.v1")));
  await expect(page).toHaveURL(/\\/invite\\/\\?id=/);
  await expect(page.getByRole("heading", { name: "Playwright Birthday" })).toBeVisible();
  await page.getByPlaceholder("First and last name").fill("Maya Guest");
  await page.getByLabel("Food preference").selectOption("Vegetarian");
  await page.getByRole("button", { name: /Send my RSVP/ }).click();
  await expect(page.getByRole("heading", { name: "You're on the list, Maya Guest!" })).toBeVisible();
  await page.goto("/");
  await expect(page.getByText("1 attending")).toBeVisible();
  await expect(page.getByText("1 GUEST")).toBeVisible();
});
test("dashboard remains usable at a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Plan a celebration/ })).toBeVisible();
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
});
