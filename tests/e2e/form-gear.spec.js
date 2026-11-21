// R4.8: auto default fills the kit, a save keeps the placeholder money, and Finish opens the sheet with the weapon equipped.
import { test, expect } from '@playwright/test';
import { login } from './helpers.js';

test('auto default equips gear and finish opens the sheet', async ({ page }) => {
    await login(page);
    const created = await page.request.post('/api/characters', {
        data: { name: `Gear ${Date.now()}`, level: 1, portrait_url: null },
    });
    expect(created.ok()).toBeTruthy();
    const { id } = await created.json();

    const form = await (await page.request.get(`/api/characters/${id}/form`)).json();
    const species = form.options.species.find((item) => item.variants.length > 0 && item.sizes.length > 0);
    expect((await page.request.put(`/api/characters/${id}/form/species`, {
        data: { species_id: species.id, size_id: species.sizes[0].id, variant: species.variants[0], eye_color: form.options.eyeColors[0] },
    })).ok()).toBeTruthy();
    const warriorId = form.options.roles.find((role) => role.key === 'warrior').id;
    const roleOptions = await (await page.request.get(`/api/character-options?level=1&role_id=${warriorId}`)).json();
    expect((await page.request.put(`/api/characters/${id}/form/role`, {
        data: {
            role_id: warriorId,
            calling_id: null,
            skills: roleOptions.skills.from.slice(0, roleOptions.skills.choose),
            feature_choices: {},
        },
    })).ok()).toBeTruthy();

    await page.goto(`/characters/${id}/edit?tab=gear`);
    await page.getByRole('tabpanel', { name: 'Inventory' }).getByRole('button', { name: 'Finish' }).click();
    await expect(page.getByRole('alert')).toContainText(/not done/i);
    await expect(page.getByText(/stat rolls/i)).toBeVisible();

    for (let index = 0; index < 8; index++) {
        expect((await page.request.post(`/api/characters/${id}/stat-rolls`, { data: { index } })).ok()).toBeTruthy();
    }
    const rolled = await (await page.request.get(`/api/characters/${id}/form`)).json();
    expect((await page.request.put(`/api/characters/${id}/form/traits`, {
        data: {
            placement: { str: 0, dex: 1, con: 2, int: 3, wis: 4, cha: 5, luc: 6, spd: 7 },
            plus2: 'str', plus1: 'dex', gifts: [],
        },
    })).ok()).toBeTruthy();
    expect(rolled.traits.rolls).toHaveLength(8);

    await page.getByRole('button', { name: 'Auto default' }).click();
    await expect(page.getByText('Money: 10')).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Weapon' })).not.toHaveValue('');

    const filled = await (await page.request.get(`/api/characters/${id}/form`)).json();
    const weapon = filled.gear.weapons.find((item) => item.id === filled.gear.weapon_id);
    expect(weapon.proficient).toBe(true);
    expect(filled.gear.money).toBe(10);

    const fake = await page.request.put(`/api/characters/${id}/form/gear`, {
        data: { weapon_id: 999999, armor_id: null, item_ids: [], money: 999 },
    });
    expect(fake.status()).toBe(400);

    const saved = await page.request.put(`/api/characters/${id}/form/gear`, {
        data: { weapon_id: weapon.id, armor_id: filled.gear.armor_id, item_ids: [], money: 999 },
    });
    expect(saved.ok()).toBeTruthy();
    expect((await saved.json()).gear.money).toBe(10);

    await page.getByRole('tabpanel', { name: 'Inventory' }).getByRole('button', { name: 'Finish' }).click();
    await expect(page).toHaveURL(new RegExp(`/characters/${id}$`));
    await expect(page.getByText(weapon.name).first()).toBeVisible();

    const sheet = await (await page.request.get(`/api/characters/${id}`)).json();
    expect(sheet.ownedWeapons.some((item) => item.is_equipped && item.name === weapon.name)).toBe(true);

    expect((await page.request.delete(`/api/characters/${id}`)).ok()).toBeTruthy();
});
