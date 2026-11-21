// R4.9: a character is made on the new form, finished, and then rolls to hit on the sheet.
import { test, expect } from '@playwright/test';
import { login } from './helpers.js';

const STATS = ['Might', 'Precision', 'Endurance', 'Intellect', 'Judgment', 'Confidence', 'Luck', 'Speed'];

test('creates a character on the new form, opens its sheet and rolls', async ({ page }) => {
    test.setTimeout(90000);
    const name = `Smoke ${Date.now()}`;
    await login(page);

    await page.goto('/home');
    await page.getByRole('link', { name: 'New character' }).click();
    await expect(page).toHaveURL(/\/characters\/new$/);
    await page.getByRole('textbox', { name: 'Name' }).fill(name);
    await page.getByRole('combobox', { name: 'Level', exact: true }).selectOption('1');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\/characters\/\d+\/edit\?tab=species/);
    const id = page.url().match(/\/characters\/(\d+)/)[1];

    await page.goto('/home');
    const unfinished = page.locator('#unfinished-character-container');
    await expect(unfinished.getByRole('heading', { name })).toBeVisible();
    await unfinished.getByRole('link', { name: new RegExp(name) }).click();
    await expect(page).toHaveURL(new RegExp(`/characters/${id}/edit`));

    const form = await (await page.request.get(`/api/characters/${id}/form`)).json();
    const species = form.options.species.find((item) => item.variants.length > 0 && item.sizes.length > 0);
    await page.getByRole('tab', { name: 'Species & look' }).click();
    await page.getByRole('combobox', { name: 'Species', exact: true }).selectOption(String(species.id));
    await page.getByRole('combobox', { name: 'Variant', exact: true }).selectOption(species.variants[0]);
    await page.getByRole('combobox', { name: 'Size', exact: true }).selectOption(String(species.sizes[0].id));
    await page.getByRole('combobox', { name: 'Eye color', exact: true }).selectOption(form.options.eyeColors[0]);
    let saved = page.waitForResponse((res) => res.url().includes('/form/species') && res.request().method() === 'PUT');
    await page.getByRole('tabpanel').getByRole('button', { name: 'Save' }).click();
    expect((await saved).ok()).toBeTruthy();

    const warrior = form.options.roles.find((role) => role.key === 'warrior');
    const roleOptions = await (await page.request.get(`/api/character-options?level=1&role_id=${warrior.id}`)).json();
    await page.getByRole('tab', { name: 'Role & calling' }).click();
    await page.getByRole('button', { name: 'Warrior', exact: true }).click();
    for (const skill of roleOptions.skills.from.slice(0, roleOptions.skills.choose)) {
        await page.getByRole('checkbox', { name: skill, exact: true }).check();
    }
    saved = page.waitForResponse((res) => res.url().includes('/form/role') && res.request().method() === 'PUT');
    await page.getByRole('tabpanel').getByRole('button', { name: 'Save' }).click();
    expect((await saved).ok()).toBeTruthy();

    await page.getByRole('tab', { name: 'Traits & gifts' }).click();
    for (let i = 0; i < 8; i++) {
        const rolled = page.waitForResponse((res) => res.url().includes('/stat-rolls') && res.request().method() === 'POST');
        await page.getByRole('listitem').filter({ hasText: `Roll ${i + 1}` }).getByRole('button', { name: 'Roll', exact: true }).click();
        expect((await rolled).ok()).toBeTruthy();
    }
    for (let i = 0; i < STATS.length; i++) {
        await page.getByRole('combobox', { name: STATS[i], exact: true }).selectOption(String(i));
    }
    await page.getByRole('combobox', { name: '+2 bonus' }).selectOption('str');
    await page.getByRole('combobox', { name: '+1 bonus' }).selectOption('dex');
    saved = page.waitForResponse((res) => res.url().includes('/form/traits') && res.request().method() === 'PUT');
    await page.getByRole('tabpanel').getByRole('button', { name: 'Save' }).click();
    expect((await saved).ok()).toBeTruthy();

    await page.getByRole('tab', { name: 'Personality' }).click();
    await page.getByRole('radio', { name: 'Lawful Good' }).click();
    await page.getByRole('combobox', { name: 'Upbringing', exact: true }).selectOption({ label: 'Orphan' });
    await page.getByRole('combobox', { name: 'Lifestyle', exact: true }).selectOption({ label: 'Solitary' });
    await page.getByRole('combobox', { name: 'Outlook', exact: true }).selectOption({ label: 'Confident' });
    saved = page.waitForResponse((res) => res.url().includes('/form/personality') && res.request().method() === 'PUT');
    await page.getByRole('tabpanel').getByRole('button', { name: 'Save' }).click();
    expect((await saved).ok()).toBeTruthy();

    await page.getByRole('tab', { name: 'Inventory' }).click();
    const filled = page.waitForResponse((res) => res.url().includes('/form/gear/default') && res.request().method() === 'POST');
    await page.getByRole('button', { name: 'Auto default' }).click();
    expect((await filled).ok()).toBeTruthy();
    // Default money is required: pick one (Finish saves it)
    await page.getByRole('button', { name: /^Average/ }).click();
    await page.getByRole('tabpanel', { name: 'Inventory' }).getByRole('button', { name: 'Finish' }).click();
    await expect(page).toHaveURL(new RegExp(`/characters/${id}$`));
    await expect(page.getByText(name).first()).toBeVisible();

    await page.locator('.btn-to-hit').first().click();
    await expect(page.locator('.roll-bubble.is-sent').first()).toContainText('to hit');

    expect((await page.request.delete(`/api/characters/${id}`)).ok()).toBeTruthy();
});
