// R4.3 form shell: a draft, a tab change and a reload keep the header and the tab.
// /characters/new makes the draft itself; a blank name becomes "One with no name".
// The full creator walk-through is rewritten in R4.9 (character.spec.js).
import { test, expect } from '@playwright/test';
import { login } from './helpers.js';

test('form shell keeps the header and the tab across a reload', async ({ page }) => {
    await login(page);
    // /characters/new makes an unnamed draft at once and keeps the requested tab
    await page.goto('/characters/new?tab=role');
    await expect(page).toHaveURL(/\/characters\/\d+\/edit\?tab=role/);
    const id = page.url().match(/\/characters\/(\d+)/)[1];
    await expect(page.getByLabel('Name')).toHaveValue('One with no name');
    await expect(page.getByText('Save the header first')).toHaveCount(0);

    // there is no header Save button: the name saves when its box loses focus, the level as soon as it changes
    await expect(page.locator('form').filter({ has: page.getByLabel('Name') }).getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);
    // a blank name saves as the default name
    await page.getByLabel('Name').fill('   ');
    let saved = page.waitForResponse((r) => r.url().endsWith(`/api/characters/${id}/form/header`));
    await page.getByLabel('Name').blur();
    expect((await saved).status(), 'header save').toBe(200);
    const blank = await (await page.request.get(`/api/characters/${id}/form`)).json();
    expect(blank.header.name).toBe('One with no name');

    const name = `Form ${Date.now()}`;
    await page.getByLabel('Name').fill(name);
    saved = page.waitForResponse((r) => r.url().endsWith(`/api/characters/${id}/form/header`));
    await page.getByLabel('Name').blur();
    expect((await saved).status(), 'name save').toBe(200);
    saved = page.waitForResponse((r) => r.url().endsWith(`/api/characters/${id}/form/header`));
    await page.getByLabel('Level').selectOption('4');
    expect((await saved).status(), 'level save').toBe(200);
    await page.reload();
    await expect(page.getByLabel('Name')).toHaveValue(name);
    await expect(page.getByLabel('Level')).toHaveValue('4');

    await page.getByRole('tab', { name: 'Species & look' }).click();
    await expect(page).toHaveURL(/tab=species/);
    await page.getByRole('tab', { name: 'Role & calling' }).click();
    await expect(page).toHaveURL(/tab=role/);
    await expect(page.getByRole('tab', { name: 'Role & calling' })).toHaveAttribute('aria-selected', 'true');

    await page.getByRole('tab', { name: 'Role & calling' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page).toHaveURL(/tab=traits/);
    await expect(page.getByRole('tab', { name: 'Traits & gifts' })).toBeFocused();

    await page.reload();
    await expect(page).toHaveURL(/tab=traits/);
    await expect(page.getByLabel('Name')).toHaveValue(name);
    await expect(page.getByLabel('Level')).toHaveValue('4');

    const boxes = await page.getByRole('tab').evaluateAll((tabs) => tabs.map((tab) => {
        const box = tab.getBoundingClientRect();
        return { top: Math.round(box.top), left: Math.round(box.left) };
    }));
    expect(boxes).toHaveLength(5);
    expect(new Set(boxes.map((box) => box.top)).size).toBe(1);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('tab', { name: 'Persona' })).toBeVisible();
    const phone = await page.getByRole('tab').evaluateAll((tabs) => tabs.map((tab) => {
        const box = tab.getBoundingClientRect();
        return { name: tab.textContent, top: Math.round(box.top) };
    }));
    expect(phone).toHaveLength(5);
    expect(new Set(phone.map((tab) => tab.top)).size).toBe(1);

    const removed = await page.request.delete(`/api/characters/${id}`);
    expect(removed.ok()).toBeTruthy();
});
