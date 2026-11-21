// R4.7: alignment, upbringing, lifestyle and outlook save and survive a reload.
// Two picks that share a magic state are refused before the database sees them.
import { test, expect } from '@playwright/test';
import { login } from './helpers.js';

test('personality tab keeps four picks and refuses two matching states', async ({ page }) => {
    await login(page);
    const created = await page.request.post('/api/characters', {
        data: { name: `Person ${Date.now()}`, level: 1, portrait_url: null },
    });
    expect(created.ok()).toBeTruthy();
    const { id } = await created.json();

    await page.goto(`/characters/${id}/edit?tab=personality`);
    await page.getByRole('radio', { name: 'Lawful Good' }).click();
    await page.getByRole('combobox', { name: 'Upbringing', exact: true }).selectOption({ label: 'Orphan' });
    await page.getByRole('combobox', { name: 'Lifestyle', exact: true }).selectOption({ label: 'Solitary' });
    await page.getByRole('combobox', { name: 'Outlook', exact: true }).selectOption({ label: 'Confident' });
    const saved = page.waitForResponse((res) => res.url().includes('/form/personality') && res.request().method() === 'PUT');
    await page.getByRole('tabpanel', { name: 'Personality' }).getByRole('button', { name: 'Save' }).click();
    expect((await saved).ok()).toBeTruthy();

    await page.reload();
    await expect(page.getByRole('radio', { name: 'Lawful Good' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('combobox', { name: 'Upbringing', exact: true })).toHaveValue(/.+/);
    await expect(page.getByRole('combobox', { name: 'Lifestyle', exact: true })).toHaveValue(/.+/);
    await expect(page.getByRole('combobox', { name: 'Outlook', exact: true })).toHaveValue(/.+/);

    const form = await (await page.request.get(`/api/characters/${id}/form`)).json();
    expect(form.personality.alignment_code).toBe('LG');
    expect(form.personality.upbringing_state).toBeTruthy();
    expect(new Set([
        form.personality.upbringing_state,
        form.personality.lifestyle_state,
        form.personality.outlook_state,
    ]).size).toBe(3);

    const stray = form.options.upbringings.find((item) => item.any_state);
    const same = await page.request.put(`/api/characters/${id}/form/personality`, {
        data: {
            alignment_code: 'LG',
            upbringing_id: stray.id,
            upbringing_state: form.personality.lifestyle_state,
            lifestyle_id: form.personality.lifestyle_id,
            outlook_id: form.personality.outlook_id,
        },
    });
    expect(same.status()).toBe(400);
    expect((await same.json()).error).toMatch(/different states/i);

    expect((await page.request.delete(`/api/characters/${id}`)).ok()).toBeTruthy();
});
