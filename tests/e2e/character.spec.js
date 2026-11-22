// R4.9: a character is made on the new form, finished, and then rolls to hit on the sheet.
import { test, expect } from '@playwright/test';
import { login } from './helpers.js';


test('creates a character on the new form, opens its sheet and rolls', async ({ page }) => {
    test.setTimeout(90000);
    const name = `Smoke ${Date.now()}`;
    await login(page);

    await page.goto('/home');
    await page.getByRole('link', { name: 'New character' }).click();
    // the draft is made straight away; it is named afterwards
    await expect(page).toHaveURL(/\/characters\/\d+\/edit\?tab=species/);
    const id = page.url().match(/\/characters\/(\d+)/)[1];
    await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('One with no name');
    // the header saves itself when the name box loses focus
    await page.getByRole('textbox', { name: 'Name' }).fill(name);
    const headerSaved = page.waitForResponse((r) => r.url().endsWith(`/api/characters/${id}/form/header`));
    await page.getByRole('textbox', { name: 'Name' }).blur();
    expect((await headerSaved).ok()).toBeTruthy();

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
    await page.getByRole('group', { name: 'Size', exact: true }).getByRole('button', { name: species.sizes[0].name, exact: true }).click();
    await page.getByRole('combobox', { name: 'Eye color', exact: true }).selectOption(form.options.eyeColors[0]);
    let saved = page.waitForResponse((res) => res.url().includes('/form/species') && res.request().method() === 'PUT');
    await page.getByRole('tabpanel').getByRole('button', { name: 'Save' }).click();
    expect((await saved).ok()).toBeTruthy();

    const warrior = form.options.roles.find((role) => role.key === 'warrior');
    const roleOptions = await (await page.request.get(`/api/character-options?level=1&role_id=${warrior.id}`)).json();
    await page.getByRole('tab', { name: 'Role & calling' }).click();
    await page.getByRole('button', { name: /^Warrior\b/ }).click();
    // skills are buttons (aria-pressed shows which are picked)
    for (const skill of roleOptions.skills.from.slice(0, roleOptions.skills.choose)) {
        await page.getByRole('tabpanel').getByRole('button', { name: skill, exact: true }).click();
    }
    saved = page.waitForResponse((res) => res.url().includes('/form/role') && res.request().method() === 'PUT');
    await page.getByRole('tabpanel').getByRole('button', { name: 'Save' }).click();
    expect((await saved).ok()).toBeTruthy();

    // Traits: the tab's tap-to-place screen has its own test (form-traits.spec.js); here the server rolls
    // all eight and they're placed the same way that test does, so this test stays about the whole journey
    await page.getByRole('tab', { name: 'Traits & gifts' }).click();
    for (let index = 0; index < 8; index++) {
        const rolled = await page.request.post(`/api/characters/${id}/stat-rolls`, { data: { index } });
        expect(rolled.ok()).toBeTruthy();
    }
    const placed = await page.request.put(`/api/characters/${id}/form/traits`, {
        data: { placement: { str: 0, dex: 1, con: 2, int: 3, wis: 4, cha: 5, luc: 6, spd: 7 }, plus2: 'str', plus1: 'dex', gifts: [] },
    });
    expect(placed.ok()).toBeTruthy();
    await page.reload();

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
    // Default money is required: pick one (Create character saves it)
    await page.getByRole('button', { name: /^Average/ }).click();
    await page.getByRole('tabpanel', { name: 'Inventory' }).getByRole('button', { name: 'Create character' }).click();
    await expect(page).toHaveURL(new RegExp(`/characters/${id}$`));
    // the sheet's own title (the closed sidebar also lists the character's name)
    await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();

    // The sheet (the block sheet is the default): roll Fists to hit through the server
    await page.getByRole('button', { name: 'Fists to hit' }).click();
    // a player's own rolls show in the roll orb (the Rolls feed block is the DM's)
    await expect(page.getByRole('button', { name: 'Open Roll Panel' })).toContainText('Fists: Chance to hit');

    expect((await page.request.delete(`/api/characters/${id}`)).ok()).toBeTruthy();
});
