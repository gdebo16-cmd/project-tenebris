// R4.4: the species tab saves, and a size above Large is refused even if the request is edited.
import { test, expect } from '@playwright/test';
import { login } from './helpers.js';

test('species tab keeps a save and refuses a size above Large', async ({ page }) => {
    await login(page);
    const created = await page.request.post('/api/characters', {
        data: { name: `Species ${Date.now()}`, level: 1, portrait_url: null },
    });
    expect(created.ok()).toBeTruthy();
    const { id } = await created.json();

    const form = await (await page.request.get(`/api/characters/${id}/form`)).json();
    const withVariant = form.options.species.find((species) => species.variants.length > 0 && species.image);
    const withSub = form.options.species.find((species) => species.subspecies.some((sub) => sub.image));
    const eye = form.options.eyeColors[0];

    await page.goto(`/characters/${id}/edit?tab=species`);
    const species = page.getByRole('combobox', { name: 'Species', exact: true });
    await species.selectOption(String(withVariant.id));
    await page.getByRole('combobox', { name: 'Variant', exact: true }).selectOption(withVariant.variants[0]);
    const sizeGroup = page.getByRole('group', { name: 'Size', exact: true });
    const sizeButton = sizeGroup.getByRole('button', { name: withVariant.sizes[0].name, exact: true });
    await sizeButton.click();
    await expect(sizeButton).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('combobox', { name: 'Eye color', exact: true }).selectOption(eye);
    await page.getByRole('textbox', { name: 'Look', exact: true }).fill('A scar over one eye');

    const art = page.getByRole('button', { name: 'Show the full picture' });
    // always the full picture (no thumbnail)
    await expect(art.locator('img')).toHaveAttribute('src', /\.png$/);
    const sizeNames = await sizeGroup.getByRole('button').allTextContents();
    expect(sizeNames.join(' ')).not.toMatch(/Enormous|Titanic/);


    const saveResponse = page.waitForResponse((res) => res.url().includes('/form/species') && res.request().method() === 'PUT');
    await page.getByRole('tabpanel').getByRole('button', { name: 'Save' }).click();
    expect((await saveResponse).ok()).toBeTruthy();

    await page.reload();
    await expect(species).toHaveValue(String(withVariant.id));
    await expect(page.getByRole('combobox', { name: 'Variant', exact: true })).toHaveValue(withVariant.variants[0]);
    await expect(sizeButton).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('combobox', { name: 'Eye color', exact: true })).toHaveValue(eye);
    await expect(page.getByRole('textbox', { name: 'Look', exact: true })).toHaveValue('A scar over one eye');

    await species.selectOption(String(withSub.id));
    await page.getByRole('combobox', { name: 'Sub-species', exact: true }).selectOption(String(withSub.subspecies[0].id));
    await expect(page.getByRole('button', { name: 'Show the full picture' }).locator('img')).toHaveAttribute('src', withSub.subspecies[0].image);

    const bad = await page.request.put(`/api/characters/${id}/form/species`, {
        data: {
            species_id: withVariant.id,
            size_id: 5,
            variant: withVariant.variants[0],
            eye_color: eye,
        },
    });
    expect(bad.status()).toBe(400);
    expect((await bad.json()).error).toMatch(/size/i);

    const removed = await page.request.delete(`/api/characters/${id}`);
    expect(removed.ok()).toBeTruthy();
});
