// R4.8: auto default fills the kit, default money is one of three presets (saved to the coin columns),
// and Finish opens the sheet with the weapon equipped and the picked coins in the purse.
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
    await expect(page.getByText(/pick default money/i)).toBeVisible();

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
    await expect(page.getByRole('combobox', { name: 'Weapon' })).not.toHaveValue('');

    // Auto default leaves money alone: no preset picked yet, an empty purse
    const filled = await (await page.request.get(`/api/characters/${id}/form`)).json();
    const weapon = filled.gear.weapons.find((item) => item.id === filled.gear.weapon_id);
    expect(weapon.proficient).toBe(true);
    expect(filled.gear.money_preset).toBe(null);
    expect(filled.gear.can_pick_money).toBe(true);
    expect(filled.missing).toContain('Inventory: pick default money');

    const fake = await page.request.put(`/api/characters/${id}/form/gear`, {
        data: { weapon_id: 999999, armor_id: null, item_ids: [] },
    });
    expect(fake.status()).toBe(400);
    const badPreset = await page.request.put(`/api/characters/${id}/form/gear`, {
        data: { weapon_id: weapon.id, armor_id: filled.gear.armor_id, item_ids: [], money_preset: 'rich' },
    });
    expect(badPreset.status()).toBe(400);

    // A preset saves coins to the coin columns; an amount from the browser is ignored
    const saved = await page.request.put(`/api/characters/${id}/form/gear`, {
        data: { weapon_id: weapon.id, armor_id: filled.gear.armor_id, item_ids: [], money: 999, money_preset: 'average' },
    });
    expect(saved.ok()).toBeTruthy();
    const savedGear = (await saved.json()).gear;
    expect(savedGear.money_preset).toBe('average');
    expect(savedGear.purse).toEqual({ copper: 10, silver: 10, gold: 0, crowns: 0, oracles: 0 });

    // Pick Wealthy on the page; Finish saves the pick
    const wealthy = page.getByRole('button', { name: /^Wealthy/ });
    await wealthy.click();
    await expect(wealthy).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: /^Average/ })).toHaveAttribute('aria-pressed', 'false');
    await page.getByRole('tabpanel', { name: 'Inventory' }).getByRole('button', { name: 'Finish' }).click();
    await expect(page).toHaveURL(new RegExp(`/characters/${id}$`));
    await expect(page.getByText(weapon.name).first()).toBeVisible();

    const sheet = await (await page.request.get(`/api/characters/${id}`)).json();
    expect(sheet.ownedWeapons.some((item) => item.is_equipped && item.name === weapon.name)).toBe(true);

    // The new sheet's purse shows the picked coins
    const newSheet = await (await page.request.get(`/api/sheets/character/${id}`)).json();
    expect(newSheet.creature.purse).toEqual({ copper: 10, silver: 10, gold: 10, crowns: 0, oracles: 0 });

    // A finished character's money changes on the sheet, not here
    const late = await page.request.put(`/api/characters/${id}/form/gear`, {
        data: { weapon_id: weapon.id, armor_id: null, item_ids: [], money_preset: 'impoverished' },
    });
    expect(late.status()).toBe(400);

    expect((await page.request.delete(`/api/characters/${id}`)).ok()).toBeTruthy();
});
