import { expect, test } from '@playwright/test';
import { ADMIN, AUTH_FILE } from '../constants';

// Runs first (project `auth`): the database starts empty, so /admin redirects to first-user setup.
test.describe.configure({ mode: 'serial' });

test('first run redirects to create-first-user and creates the admin', async ({ page }) => {
	await page.goto('/admin');
	await expect(page).toHaveURL(/\/admin\/create-first-user$/);
	await page.getByLabel('Name').fill(ADMIN.name);
	await page.getByLabel('Email').fill(ADMIN.email);
	await page.getByLabel('Password').fill(ADMIN.password);
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
	await expect(page).toHaveURL(/\/admin\/?$/);
	await expect(page.getByTestId('whoami')).toHaveText(ADMIN.email);
});

test('the first-user form is gone once a user exists', async ({ page }) => {
	await page.goto('/admin/create-first-user');
	await expect(page).not.toHaveURL(/create-first-user/);
	await expect(page.getByRole('button', { name: 'Create account' })).toHaveCount(0);
});

test('log out, a wrong password shows an error, the right one signs in', async ({ page }) => {
	// Fresh sign-in (the first test's session lives in another context).
	await page.goto('/admin');
	await expect(page.getByRole('heading', { name: 'Halden Studio' })).toBeVisible();
	await expect(page.getByText('Sign in to continue.')).toBeVisible();

	await page.getByLabel('Email').fill(ADMIN.email);
	await page.getByLabel('Password').fill('definitely-the-wrong-password');
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByTestId('error')).toBeVisible();
	await expect(page.getByTestId('whoami')).toHaveCount(0);

	await page.getByLabel('Email').fill(ADMIN.email);
	await page.getByLabel('Password').fill(ADMIN.password);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByTestId('whoami')).toHaveText(ADMIN.email);

	await page.getByRole('button', { name: 'Log out' }).click();
	await expect(page.getByText('Sign in to continue.')).toBeVisible();
	await expect(page.getByTestId('whoami')).toHaveCount(0);
	// Protected pages bounce back to the sign-in form.
	await page.goto('/admin/collections/pages');
	await expect(page.getByText('Sign in to continue.')).toBeVisible();
});

test('sign in again and save the session for the admin tests', async ({ page }) => {
	await page.goto('/admin');
	await page.getByLabel('Email').fill(ADMIN.email);
	await page.getByLabel('Password').fill(ADMIN.password);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
	await page.context().storageState({ path: AUTH_FILE });
});
