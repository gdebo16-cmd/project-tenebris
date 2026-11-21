// R4.3 form shell: a draft, a tab change and a reload keep the header and the tab.
// The full creator walk-through is rewritten in R4.9 (character.spec.js).
import { test, expect } from '@playwright/test';
import { login } from './helpers.js';

test('form shell keeps the header and the tab across a reload', async ({ page }) => {
    await login(page);
    await page.goto('/characters/new');

    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('alert')).toContainText('Give your character a name');
    await expect(page).toHaveURL(/\/characters\/new/);

    const name = `Form ${Date.now()}`;
    await page.getByLabel('Name').fill(name);
    await page.getByLabel('Level').selectOption('4');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\/characters\/\d+\/edit\?tab=species/);
    await expect(page.getByLabel('Name')).toHaveValue(name);
    await expect(page.getByLabel('Level')).toHaveValue('4');

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

    const id = page.url().match(/\/characters\/(\d+)/)[1];
    const removed = await page.request.delete(`/api/characters/${id}`);
    expect(removed.ok()).toBeTruthy();
});
