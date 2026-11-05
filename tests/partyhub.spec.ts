import { test, expect, type Page, type Route } from "@playwright/test";

const SUPABASE = "https://mqzjziaxbbozytumwsca.supabase.co";
const HOST_ID = "9f9d4b8a-8e2d-4a1f-9a2a-9f9d4b8a8e2d";
const PARTY_ID = "2b6e2c90-7d3f-4c9a-8a21-4dbd2b6e2c90";
const INVITE_TOKEN = "a".repeat(64);
const EDIT_TOKEN = "b".repeat(64);
const HOST = { id: HOST_ID, aud: "authenticated", role: "authenticated", email: "host@example.test", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00.000Z" };

async function useHostSession(page: Page) {
  await page.addInitScript(({ host }) => {
    const payload = btoa(JSON.stringify({ sub: host.id, role: "authenticated", aud: "authenticated", exp: 4102444800 }));
    const accessToken = `eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.${payload}.test`;
    localStorage.setItem("sb-mqzjziaxbbozytumwsca-auth-token", JSON.stringify({
      access_token: accessToken,
      token_type: "bearer",
      expires_in: 3600,
      expires_at: 4102444800,
      refresh_token: "test-refresh-token",
      user: host
    }));
  }, { host: HOST });
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function mockHostApi(page: Page, options: { createError?: boolean; listError?: boolean; signOutError?: boolean } = {}) {
  const parties: any[] = [];
  const calls: { method: string; path: string; body?: any }[] = [];
  await page.route(`${SUPABASE}/**`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    let body: any;
    try { body = request.postDataJSON(); } catch { body = undefined; }
    calls.push({ method, path: url.pathname, body });

    if (url.pathname === "/auth/v1/user" && method === "GET") return fulfillJson(route, HOST);
    if (url.pathname === "/auth/v1/logout" && method === "POST") {
      if (options.signOutError) return fulfillJson(route, { message: "logout failed" }, 500);
      return route.fulfill({ status: 204 });
    }
    if (url.pathname === "/rest/v1/parties" && method === "GET") {
      if (options.listError) return fulfillJson(route, { message: "database unavailable" }, 503);
      return fulfillJson(route, parties);
    }
    if (url.pathname === "/rest/v1/parties" && method === "POST") {
      if (options.createError) return fulfillJson(route, { message: "constraint violation" }, 400);
      const created = {
        id: PARTY_ID, title: body.title, description: body.description, party_type: body.party_type,
        starts_at: body.starts_at, ends_at: body.ends_at, arrival_from: body.arrival_from,
        arrival_until: body.arrival_until, timezone: body.timezone, currency: body.currency,
        status: body.status, guest_rsvps: []
      };
      parties.push(created);
      return fulfillJson(route, { id: PARTY_ID });
    }
    if (url.pathname === "/rest/v1/rpc/create_party_invite" && method === "POST") return fulfillJson(route, INVITE_TOKEN);
    return fulfillJson(route, { message: `Unexpected mocked request: ${method} ${url.pathname}` }, 500);
  });
  return calls;
}

async function mockInviteApi(page: Page, options: { invalid?: boolean; loadError?: boolean; submitError?: boolean } = {}) {
  const calls: any[] = [];
  await page.route(`${SUPABASE}/**`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    let body: any;
    try { body = request.postDataJSON(); } catch { body = undefined; }
    calls.push({ path: url.pathname, body });
    if (url.pathname === "/rest/v1/rpc/get_invitation_preview") {
      if (options.loadError) return route.abort("failed");
      if (options.invalid) return fulfillJson(route, []);
      return fulfillJson(route, [{
        party_id: PARTY_ID, title: "Summer rooftop party", description: "Bring your best energy.",
        party_type: "house_party", starts_at: "2027-06-10T19:00:00.000Z",
        ends_at: "2027-06-10T23:00:00.000Z", arrival_from: "2027-06-10T18:30:00.000Z",
        arrival_until: "2027-06-10T20:00:00.000Z", timezone: "UTC"
      }]);
    }
    if (url.pathname === "/rest/v1/rpc/submit_guest_rsvp") {
      if (options.submitError) return fulfillJson(route, { message: "invalid edit token" }, 400);
      const token = body?.p_edit_token ? null : EDIT_TOKEN;
      return fulfillJson(route, { rsvp_id: "7a7f1a9b-c31d-4ac4-bde8-a6c8e7a2b2c1", edit_token: token });
    }
    return fulfillJson(route, { message: `Unexpected mocked request: ${request.method()} ${url.pathname}` }, 500);
  });
  return calls;
}

test("public home renders the unauthenticated host journey", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Bring your people together/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Host sign in/ }).first()).toBeVisible();
  await expect(page.getByText("Your celebrations, all in one place.")).toBeVisible();
});

test("login rejects an empty address and sends a magic link on success", async ({ page }) => {
  await page.route(`${SUPABASE}/auth/v1/otp**`, route => fulfillJson(route, {}));
  await page.goto("/login/");
  const email = page.getByLabel("Email address");
  await email.fill("not-an-email");
  await page.getByRole("button", { name: /Send magic link/ }).click();
  await expect(email).toHaveJSProperty("validity.valid", false);
  await email.fill("guest@example.test");
  await page.getByRole("button", { name: /Send magic link/ }).click();
  await expect(page.getByText(/Magic link sent/)).toBeVisible();
});

test("login displays a recoverable provider failure", async ({ page }) => {
  await page.route(`${SUPABASE}/auth/v1/otp`, route => fulfillJson(route, { message: "mail provider unavailable" }, 503));
  await page.goto("/login/");
  await page.getByLabel("Email address").fill("host@example.test");
  await page.getByRole("button", { name: /Send magic link/ }).click();
  await expect(page.getByRole("alert")).toBeVisible();
});

test("missing and malformed invite tokens fail closed without making a database call", async ({ page }) => {
  const calls = await mockInviteApi(page);
  await page.goto("/invite/");
  await expect(page.getByRole("heading", { name: "This invitation isn't available." })).toBeVisible();
  expect(calls).toHaveLength(0);
  await page.goto("/invite/?token=short");
  await expect(page.getByRole("heading", { name: "This invitation isn't available." })).toBeVisible();
  expect(calls).toHaveLength(0);
});

test("invalid, expired or revoked invite has a safe empty state", async ({ page }) => {
  await mockInviteApi(page, { invalid: true });
  await page.goto(`/invite/?token=${INVITE_TOKEN}`);
  await expect(page.getByRole("heading", { name: "This invitation isn't available." })).toBeVisible();
  await expect(page.getByText(/expired or been revoked/)).toBeVisible();
});

test("invite loading failure is not misreported as an invalid token and can be retried", async ({ page }) => {
  let attempts = 0;
  await page.route(`${SUPABASE}/rest/v1/rpc/get_invitation_preview`, async route => {
    attempts += 1;
    if (attempts === 1) return route.abort("failed");
    return fulfillJson(route, [{
      party_id: PARTY_ID, title: "Retry party", description: "", party_type: "dinner",
      starts_at: "2027-06-10T19:00:00.000Z", ends_at: "2027-06-10T23:00:00.000Z",
      arrival_from: null, arrival_until: null, timezone: "UTC"
    }]);
  });
  await page.goto(`/invite/?token=${INVITE_TOKEN}`);
  await expect(page.getByRole("heading", { name: "Couldn't load this invitation." })).toBeVisible();
  await page.getByRole("button", { name: /Try again/ }).click();
  await expect(page.getByRole("heading", { name: "Retry party" })).toBeVisible();
});

test("guest can RSVP and update only with the browser-held edit token", async ({ page }) => {
  const calls = await mockInviteApi(page);
  await page.goto(`/invite/?token=${INVITE_TOKEN}`);
  await expect(page.getByRole("heading", { name: "Summer rooftop party" })).toBeVisible();
  await expect(page.getByText(/Thursday, 10 June 2027/)).toBeVisible();
  await page.getByLabel("Your name").fill("Asha Guest");
  await page.getByRole("button", { name: /Maybe/ }).click();
  await page.getByLabel(/Number of guests including you/).selectOption("3");
  await page.getByLabel("Food preference").selectOption("vegetarian");
  await page.getByRole("button", { name: /Send my RSVP/ }).click();
  await expect(page.getByRole("heading", { name: "Thanks, Asha Guest!" })).toBeVisible();
  const first = calls.find(call => call.path.endsWith("/submit_guest_rsvp"));
  expect(first.body.p_response).toBe("maybe");
  expect(first.body.p_guest_count).toBe(3);
  expect(first.body.p_dietary_type).toBe("vegetarian");
  expect(first.body.p_edit_token).toBeNull();

  await page.getByRole("button", { name: "Update my RSVP" }).click();
  await page.getByRole("button", { name: /Count me in/ }).click();
  await page.getByRole("button", { name: /Send my RSVP/ }).click();
  await expect(page.getByRole("heading", { name: "Thanks, Asha Guest!" })).toBeVisible();
  const submissions = calls.filter(call => call.path.endsWith("/submit_guest_rsvp"));
  expect(submissions).toHaveLength(2);
  expect(submissions[1].body.p_edit_token).toBe(EDIT_TOKEN);
  expect(submissions[1].body.p_response).toBe("yes");
});

test("guest RSVP failure shows a friendly error and allows retry", async ({ page }) => {
  await mockInviteApi(page, { submitError: true });
  await page.goto(`/invite/?token=${INVITE_TOKEN}`);
  await page.getByLabel("Your name").fill("Asha Guest");
  await page.getByRole("button", { name: /Send my RSVP/ }).click();
  await expect(page.getByRole("alert")).toContainText(/couldn't save your RSVP/i);
  await expect(page.getByRole("button", { name: /Send my RSVP/ })).toBeEnabled();
});

test("authenticated host can create a party, create an invite and share it", async ({ page, context }) => {
  await useHostSession(page);
  const calls = await mockHostApi(page);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await expect(page.getByText("host@example.test")).toBeVisible();
  await page.getByRole("button", { name: /Plan a celebration/ }).click();
  await page.getByLabel("What's the occasion?").fill("QA birthday");
  await page.getByLabel("Date").fill("2027-06-10");
  await page.getByLabel("Starts").fill("19:00");
  await page.getByLabel("Ends").fill("23:00");
  await page.getByRole("button", { name: /Create celebration/ }).click();
  await expect(page.getByRole("heading", { name: "QA birthday" })).toBeVisible();
  const insert = calls.find(call => call.method === "POST" && call.path === "/rest/v1/parties");
  expect(insert.body.title).toBe("QA birthday");
  expect(insert.body.status).toBe("published");
  await page.getByRole("button", { name: /Create invite/ }).click();
  await expect(page.getByRole("link", { name: /Share on WhatsApp/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Copy link/ })).toBeVisible();
  expect(calls.some(call => call.path.endsWith("/rpc/create_party_invite"))).toBeTruthy();
});

test("host form rejects whitespace-only titles", async ({ page }) => {
  await useHostSession(page);
  const calls = await mockHostApi(page);
  await page.goto("/");
  await page.getByRole("button", { name: /Plan a celebration/ }).click();
  await page.getByLabel("What's the occasion?").fill("   ");
  await page.getByLabel("Date").fill("2027-06-10");
  await page.getByRole("button", { name: /Create celebration/ }).click();
  await expect(page.getByRole("alert")).toContainText(/title/i);
  expect(calls.some(call => call.method === "POST" && call.path === "/rest/v1/parties")).toBeFalsy();
});

test("host form rejects incomplete arrival windows", async ({ page }) => {
  await useHostSession(page);
  const calls = await mockHostApi(page);
  await page.goto("/");
  await page.getByRole("button", { name: /Plan a celebration/ }).click();
  await page.getByLabel("What's the occasion?").fill("Arrival validation party");
  await page.getByLabel("Date").fill("2027-06-10");
  await page.getByLabel("Arrival until").fill("");
  await page.getByRole("button", { name: /Create celebration/ }).click();
  await expect(page.getByRole("alert")).toContainText(/both arrival times/i);
  expect(calls.some(call => call.method === "POST" && call.path === "/rest/v1/parties")).toBeFalsy();
});

test("host dashboard reports database failures without hanging", async ({ page }) => {
  await useHostSession(page);
  await mockHostApi(page, { listError: true });
  await page.goto("/");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("button", { name: /Refresh/ })).toBeVisible();
});

test("host creation reports database constraint failures and re-enables submit", async ({ page }) => {
  await useHostSession(page);
  await mockHostApi(page, { createError: true });
  await page.goto("/");
  await page.getByRole("button", { name: /Plan a celebration/ }).click();
  await page.getByLabel("What's the occasion?").fill("Database failure party");
  await page.getByLabel("Date").fill("2027-06-10");
  await page.getByRole("button", { name: /Create celebration/ }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("button", { name: /Create celebration/ })).toBeEnabled();
});

test("failed sign-out keeps the host session visible and reports the failure", async ({ page }) => {
  await useHostSession(page);
  await mockHostApi(page, { signOutError: true });
  await page.goto("/");
  await expect(page.getByText("host@example.test")).toBeVisible();
  await page.getByRole("button", { name: /Sign out/ }).click();
  await expect(page.getByRole("alert")).toContainText(/could not sign you out/i);
  await expect(page.getByText("host@example.test")).toBeVisible();
});

test("mobile home has no horizontal overflow and all key actions remain reachable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Host sign in/ }).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});


test("production service worker serves a privacy-safe offline fallback", async ({ page, context }) => {
  await page.goto("/");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 15_000 });
  await context.setOffline(true);
  await page.goto("/invite/");
  await expect(page.getByRole("heading", { name: "You're offline" })).toBeVisible();
  await context.setOffline(false);
});
\ntest("PWA manifest points to a real app icon", async ({ page, request }) => {
  const manifestResponse = await request.get("/manifest.webmanifest");
  expect(manifestResponse.ok()).toBeTruthy();
  const manifest = await manifestResponse.json();
  expect(manifest.icons.length).toBeGreaterThan(0);
  for (const icon of manifest.icons) {
    const response = await request.get(icon.src);
    expect(response.ok(), `missing manifest icon: ${icon.src}`).toBeTruthy();
  }
});
