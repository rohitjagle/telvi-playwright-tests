import { test, expect } from '@playwright/test';

const BASE_URL = 'https://telvi.tv2zdev.com';
const CREDENTIALS = { subscriberName: '111213', activationCode: '12345' };

test.describe('App Launch and Login Flow', () => {

  test('Complete login, account verification and logout', async ({ page }, testInfo) => {

    // ── Step 1: Launch the app ────────────────────────────────────────────────
    await test.step('Step 1: Launch the app', async () => {
      await page.goto(`${BASE_URL}/home`, { waitUntil: 'load' });
      await page.waitForTimeout(2000);
      await expect(page).toHaveTitle(/telvi/i);

      await testInfo.attach('01 - App Home Page', {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
    });

    // ── Step 2: Click Login button ────────────────────────────────────────────
    await test.step('Step 2: Click Login button', async () => {
      await page.getByRole('link', { name: /^login$/i }).click();
      await expect(page.getByPlaceholder('Enter Your Subscriber Name')).toBeVisible({ timeout: 10000 });

      await testInfo.attach('02 - Login Form Opened', {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
    });

    // ── Step 2a: Enter subscriber name ────────────────────────────────────────
    await test.step('Step 2a: Enter subscriber name (111213)', async () => {
      await page.getByPlaceholder('Enter Your Subscriber Name').fill(CREDENTIALS.subscriberName);

      await testInfo.attach('02a - Subscriber Name Entered', {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
    });

    // ── Step 2b: Enter activation code ───────────────────────────────────────
    await test.step('Step 2b: Enter activation code (12345)', async () => {
      await page.getByPlaceholder('Enter Your Activation Code').fill(CREDENTIALS.activationCode);

      await testInfo.attach('02b - Activation Code Entered', {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
    });

    // ── Step 2c: Check Terms & Conditions checkbox ────────────────────────────
    await test.step('Step 2c: Check Terms & Conditions checkbox', async () => {
      const checkbox = page.locator('input[type="checkbox"]').first();
      await checkbox.check();
      await expect(checkbox).toBeChecked();

      await testInfo.attach('02c - Checkbox Checked', {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
    });

    // ── Step 2d: Submit login form ────────────────────────────────────────────
    // KNOWN BUG: after clicking Sign In, a spinner appears but the form does
    // not close / redirect. A page refresh is required as a workaround.
    // The screenshot below captures the spinner state as evidence of the bug.
    await test.step('Step 2d: Submit login form (Sign In)', async () => {
      await page.locator('#signin-btn').click();
      await page.waitForTimeout(3000); // allow spinner to settle

      await testInfo.attach('02d - After Submit (spinner bug visible)', {
        body: await page.screenshot(),
        contentType: 'image/png',
      });

      // Wait for login form to disappear — will fail here due to known bug
      await expect(
        page.getByPlaceholder('Enter Your Subscriber Name'),
        'Login form should close after successful submit — KNOWN BUG: spinner hangs'
      ).toBeHidden({ timeout: 15000 });
    });

    // ── Step 3: Verify successful login ──────────────────────────────────────
    await test.step('Step 3: Verify login — user icon visible in header', async () => {
      // After login the "Login" link is replaced by a user profile icon
      await expect(page.locator('img.non-profile-pic')).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole('link', { name: /^login$/i })).toBeHidden();

      await testInfo.attach('03 - Successfully Logged In', {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
    });

    // ── Step 4: Open profile dropdown → Navigate to My Account ───────────────
    await test.step('Step 4: Click My Account icon → navigate to My Account page', async () => {
      // Open the profile dropdown (top-right user icon)
      await page.locator('a.dropdown-toggle.cursor-pointer').click();
      await expect(page.locator('a[href="/account/settings"]')).toBeVisible({ timeout: 5000 });

      await testInfo.attach('04a - Profile Dropdown Opened', {
        body: await page.screenshot(),
        contentType: 'image/png',
      });

      // Click My Account
      await page.locator('a[href="/account/settings"]').click();
      await page.waitForURL('**/account/settings', { timeout: 10000 });

      await testInfo.attach('04b - My Account Page', {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
    });

    // ── Step 5: Verify account details are visible ────────────────────────────
    await test.step('Step 5: Verify account details visible', async () => {
      await expect(page.getByRole('heading', { name: /my account/i })).toBeVisible();
      await expect(page.getByText('Personal Information')).toBeVisible();
      await expect(page.getByText('Your Name')).toBeVisible();
      await expect(page.getByText('E-mail')).toBeVisible();
      await expect(page.getByText('User ID')).toBeVisible();

      await testInfo.attach('05 - Account Details Verified (full page)', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });
    });

    // ── Step 6: Scroll to bottom of My Account page ───────────────────────────
    await test.step('Step 6: Scroll to the bottom of My Account page', async () => {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1500);

      await testInfo.attach('06 - Bottom of My Account Page', {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
    });

    // ── Step 6a: Logout via Sign out ──────────────────────────────────────────
    await test.step('Step 6a: Logout via Sign out button', async () => {
      // "Sign out" is visible in the left sidebar at the bottom of the account page
      await page.getByText('Sign out').click();
      await page.waitForTimeout(2000);

      await testInfo.attach('06a - After Logout Click', {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
    });

    // ── Step 6b: Verify logout successful ─────────────────────────────────────
    await test.step('Step 6b: Verify logout — "Log out successful!" message and Login link visible', async () => {
      await expect(page.getByText('Log out successful!')).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole('link', { name: /^login$/i })).toBeVisible({ timeout: 10000 });

      await testInfo.attach('07 - Logged Out Successfully', {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
    });

  });

});
