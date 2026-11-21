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
    await page.getByRole('button', { name: 'Roll', exact: true }).first().click();
    await expect(page.locator('ol li').first()).not.toContainText('Not rolled');

    for (let index = 1; index < 8; index++) {
        const rolled = await page.request.post(`/api/characters/${id}/stat-rolls`, { data: { index } });
        expect(rolled.ok()).toBeTruthy();
    }

    const form = await (await page.request.get(`/api/characters/${id}/form`)).json();
    const totals = form.traits.rolls.map((roll) => roll.total);
    expect(totals).toHaveLength(8);

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
    await expect(page.getByLabel('Might')).not.toHaveValue('');

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
    expect((await page.request.post(`/api/characters/${id}/finish`)).ok()).toBeTruthy();

    const locked = await page.request.post(`/api/characters/${id}/stat-rolls`, { data: { index: 0 } });
    expect(locked.status()).toBe(400);
    expect((await locked.json()).error).toBe('Change the traits of a finished character with the old editor for now');

    const traitsAgain = await page.request.put(`/api/characters/${id}/form/traits`, {
        data: { placement, plus2: 'str', plus1: 'dex', gifts: [] },
    });
    expect(traitsAgain.status()).toBe(400);
    expect((await traitsAgain.json()).error).toBe('Change the traits of a finished character with the old editor for now');

    const roleAgain = await page.request.put(`/api/characters/${id}/form/role`, {
        data: {
            role_id: roleOptions.roles.find((role) => role.key === 'warrior').id,
            calling_id: null,
            skills: roleOptions.skills.from.slice(0, roleOptions.skills.choose),
            feature_choices: {},
        },
    });
    expect(roleAgain.status()).toBe(400);
    expect((await roleAgain.json()).error).toBe('Change the role of a finished character with the old editor for now');

    expect((await page.request.delete(`/api/characters/${id}`)).ok()).toBeTruthy();
});
