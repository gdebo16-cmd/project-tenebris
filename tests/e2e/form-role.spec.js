// R4.5: level 3 shows a calling, level 2 hides it, and the server refuses a calling or a skill that is not allowed.
import { test, expect } from '@playwright/test';
import { login } from './helpers.js';

test('role tab clears a calling below level 3 and refuses a bad skill', async ({ page }) => {
    await login(page);
    const created = await page.request.post('/api/characters', {
        data: { name: `Role ${Date.now()}`, level: 3, portrait_url: null },
    });
    expect(created.ok()).toBeTruthy();
    const { id } = await created.json();

    const form = await (await page.request.get(`/api/characters/${id}/form`)).json();
    const warrior = form.options.roles.find((role) => role.key === 'warrior');
    const options = await (await page.request.get(`/api/character-options?level=3&role_id=${warrior.id}`)).json();
    const calling = options.callings[0];
    const skills = options.skills.from.slice(0, options.skills.choose);

    await page.goto(`/characters/${id}/edit?tab=role`);
    await page.getByRole('button', { name: 'Warrior', exact: true }).click();
    await expect(page.getByText('Hit die d12')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show the full rune' }).locator('img')).toHaveAttribute('src', /\/glyphs\/classes\/thumbs\/warrior\.webp$/);

    await page.getByRole('combobox', { name: 'Calling' }).selectOption(String(calling.id));
    for (const skill of skills) await page.getByRole('checkbox', { name: skill, exact: true }).check();

    const saved = page.waitForResponse((res) => res.url().includes('/form/role') && res.request().method() === 'PUT');
    await page.getByRole('tabpanel').getByRole('button', { name: 'Save' }).click();
    expect((await saved).ok()).toBeTruthy();

    await page.reload();
    await expect(page.getByRole('button', { name: 'Warrior', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('combobox', { name: 'Calling' })).toHaveValue(String(calling.id));
    for (const skill of skills) await expect(page.getByRole('checkbox', { name: skill, exact: true })).toBeChecked();

    await page.getByLabel('Level').fill('2');
    const headerSaved = page.waitForResponse((res) => res.url().includes('/form/header') && res.request().method() === 'PUT');
    await page.locator('form').first().getByRole('button', { name: 'Save' }).click();
    expect((await headerSaved).ok()).toBeTruthy();
    await expect(page.getByRole('combobox', { name: 'Calling' })).toHaveCount(0);

    const after = await (await page.request.get(`/api/characters/${id}/form`)).json();
    expect(after.role.calling_id).toBeNull();

    const refusedCalling = await page.request.put(`/api/characters/${id}/form/role`, {
        data: { role_id: warrior.id, calling_id: calling.id, skills, feature_choices: {} },
    });
    expect(refusedCalling.status()).toBe(400);
    expect((await refusedCalling.json()).error).toMatch(/calling/i);

    const refusedSkill = await page.request.put(`/api/characters/${id}/form/role`, {
        data: { role_id: warrior.id, calling_id: null, skills: ['Not a skill', ...skills.slice(1)], feature_choices: {} },
    });
    expect(refusedSkill.status()).toBe(400);
    expect((await refusedSkill.json()).error).toMatch(/skill/i);

    const removed = await page.request.delete(`/api/characters/${id}`);
    expect(removed.ok()).toBeTruthy();
});
