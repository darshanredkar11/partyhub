import { test, expect } from "@playwright/test";

test("host dashboard directs unauthenticated visitors to password sign in", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Bring your people together/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Host sign in/ }).first()).toBeVisible();
  await expect(page.getByText("Your celebrations, all in one place.")).toBeVisible();
});

test("guest invitation rejects missing or invalid token safely", async ({ page }) => {
  await page.goto("/invite/");
  await expect(page.getByRole("heading", { name: "This invitation isn't available." })).toBeVisible();
  await expect(page.getByText(/expired, been revoked or reached its guest limit/)).toBeVisible();
});

test("login page renders accessible email and password account forms", async ({ page }) => {
  await page.goto("/login/");
  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
  await expect(page.getByLabel("Email address")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: /Create account/ })).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: /^Sign in$/ })).toBeVisible();
});

test("dashboard remains usable at a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Host sign in/ }).first()).toBeVisible();
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
});
