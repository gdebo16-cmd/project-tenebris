// R4.6: saved scores are the server's rolls plus bonuses. A fake score or a repeated roll index is refused.
import { test, expect } from '@playwright/test';
import { login } from './helpers.js';

test('traits scores follow the server rolls, and a finished character cannot reroll', async ({ page }) => {
    await login(page);
    const created = await page.request.post('/api/characters', {
        data: { name: `Traits ${Date.now()}`, level: 1, portrait_url: null },
    });
    expect(created.ok()).toBeTruthy();
    const { id } = await created.json();

    await page.goto(`/characters/${id}/edit?tab=traits`);
    // Roll 1 on the page, and wait for the server before rolling the rest, so the eight rolls don't race
    const firstRoll = page.waitForResponse((res) => res.url().includes('/stat-rolls') && res.request().method() === 'POST');
    await page.getByRole('button', { name: 'Roll', exact: true }).first().click();
    expect((await firstRoll).ok()).toBeTruthy();
    await expect(page.locator('ol li').first()).toContainText('Tap to place');

    for (let index = 1; index < 8; index++) {
        const rolled = await page.request.post(`/api/characters/${id}/stat-rolls`, { data: { index } });
        expect(rolled.ok()).toBeTruthy();
    }

    const form = await (await page.request.get(`/api/characters/${id}/form`)).json();
    // Every one of the eight rolls must be made (an unrolled one is null) before scores can follow them
    expect(form.traits.rolls).toHaveLength(8);
    for (const roll of form.traits.rolls) expect(roll).not.toBeNull();
    const totals = form.traits.rolls.map((roll) => roll.total);

    const placement = { str: 0, dex: 1, con: 2, int: 3, wis: 4, cha: 5, luc: 6, spd: 7 };
    const saved = await page.request.put(`/api/characters/${id}/form/traits`, {
        data: { placement, plus2: 'str', plus1: 'str', gifts: [], str: 99 },
    });
    expect(saved.ok()).toBeTruthy();
    const body = await saved.json();
    expect(body.traits.scores.str).toBe(totals[0] + 3);
    expect(body.traits.scores.dex).toBe(totals[1]);
    expect(body.traits.scores.str).not.toBe(99);

    await page.reload();
    // Might is a stat tile now: after a reload it still shows roll 1's total
    await expect(page.locator('form button').filter({ hasText: /^Might/ })).toContainText(String(totals[0]));

    const duplicate = await page.request.put(`/api/characters/${id}/form/traits`, {
        data: { placement: { ...placement, dex: 0 }, plus2: 'str', plus1: 'dex', gifts: [] },
    });
    expect(duplicate.status()).toBe(400);

    const tooMany = form.options.gifts.from.slice(0, form.options.gifts.choose + 1).map((gift) => gift.id);
    const refusedGifts = await page.request.put(`/api/characters/${id}/form/traits`, {
        data: { placement, plus2: 'str', plus1: 'dex', gifts: tooMany },
    });
    expect(refusedGifts.status()).toBe(400);

    const species = form.options.species.find((item) => item.variants.length > 0 && item.sizes.length > 0);
    expect((await page.request.put(`/api/characters/${id}/form/species`, {
        data: { species_id: species.id, size_id: species.sizes[0].id, variant: species.variants[0], eye_color: form.options.eyeColors[0] },
    })).ok()).toBeTruthy();
    const roleOptions = await (await page.request.get(`/api/character-options?level=1&role_id=${form.options.roles.find((role) => role.key === 'warrior').id}`)).json();
    expect((await page.request.put(`/api/characters/${id}/form/role`, {
        data: {
            role_id: roleOptions.roles.find((role) => role.key === 'warrior').id,
            calling_id: null,
            skills: roleOptions.skills.from.slice(0, roleOptions.skills.choose),
            feature_choices: {},
        },
    })).ok()).toBeTruthy();
    const draftSheet = await (await page.request.get(`/api/characters/${id}`)).json();
    expect(draftSheet.character.class_id).toBeNull();
    expect((await page.request.post(`/api/characters/${id}/finish`, { data: { money_preset: 'impoverished' } })).ok()).toBeTruthy();

    const sheetBefore = await (await page.request.get(`/api/characters/${id}`)).json();
    const sides = Number(String(form.options.roles.find((role) => role.key === 'warrior').hit_die).match(/\d+/)[0]);
    const conMod = Math.floor(Number(sheetBefore.character.con) / 2) - 5;
    const perLevel = Math.max(1, Math.floor(sides / 2) + 1 + conMod);
    const raised = await page.request.put(`/api/characters/${id}/form/header`, {
        data: { name: sheetBefore.character.name, level: 2, portrait_url: null },
    });
    expect(raised.ok()).toBeTruthy();
    const sheetAfter = await (await page.request.get(`/api/characters/${id}`)).json();
    expect(sheetAfter.character.level).toBe(2);
    expect(sheetAfter.character.max_hp).toBe(sheetBefore.character.max_hp + perLevel);
    expect(sheetAfter.character.current_hp).toBe(sheetBefore.character.current_hp);

    const lowered = await page.request.put(`/api/characters/${id}/form/header`, {
        data: { name: sheetBefore.character.name, level: 1, portrait_url: null },
    });
    expect(lowered.ok()).toBeTruthy();
    const sheetBack = await (await page.request.get(`/api/characters/${id}`)).json();
    expect(sheetBack.character.level).toBe(1);
    expect(sheetBack.character.max_hp).toBe(sheetBefore.character.max_hp);
    expect(sheetBack.character.class_id).not.toBeNull();

    const oldMod = Math.floor(Number(sheetBack.character.con) / 2) - 5;
    const newCon = totals[0];
    const newMod = Math.floor(newCon / 2) - 5;
    const swapped = await page.request.put(`/api/characters/${id}/form/traits`, {
        data: { placement: { ...placement, str: 2, con: 0 }, plus2: 'str', plus1: 'dex', gifts: [] },
    });
    expect(swapped.ok()).toBeTruthy();
    const endured = await (await page.request.get(`/api/characters/${id}`)).json();
    expect(endured.character.con).toBe(newCon);
    expect(endured.character.max_hp).toBe(Math.max(1, sheetBack.character.max_hp - oldMod + newMod));

    const other = form.options.roles.find((role) => role.key !== 'warrior');
    const otherOptions = await (await page.request.get(`/api/character-options?level=1&role_id=${other.id}`)).json();
    const recastSave = await page.request.put(`/api/characters/${id}/form/role`, {
        data: {
            role_id: other.id,
            calling_id: null,
            skills: otherOptions.skills.from.slice(0, otherOptions.skills.choose),
            feature_choices: {},
        },
    });
    expect(recastSave.ok()).toBeTruthy();
    const recast = await (await page.request.get(`/api/characters/${id}`)).json();
    expect(recast.character.class_id).not.toBe(sheetBack.character.class_id);
    expect(recast.character.subclass_id).toBeNull();

    const locked = await page.request.post(`/api/characters/${id}/stat-rolls`, { data: { index: 0 } });
    expect(locked.status()).toBe(400);
    expect((await locked.json()).error).toMatch(/finished/i);

    expect((await page.request.delete(`/api/characters/${id}`)).ok()).toBeTruthy();
});
