import { test, expect } from '@playwright/test';

test('agenda new-task modal stays open for logged in user', async ({ page }) => {
  await page.goto('/');

  await page.evaluate(() => {
    localStorage.setItem('userSession', JSON.stringify({
      jwt: 'e2e-token',
      user: {
        id: 'e2e-user',
        username: 'skillparty',
        avatar_url: '/app.png',
        github_id: '12345',
      },
      loginTime: Date.now(),
    }));
  });

  await page.reload();

  await page.locator('#agenda-btn').click();
  await expect(page.locator('#agenda-view')).toBeVisible();

  const addButtons = [
    page.locator('.toolbar-btn-add').first(),
    page.locator('.quick-actions-block .btn-action.primary').first(),
  ];

  for (const addButton of addButtons) {
    if (!(await addButton.isVisible())) continue;

    await addButton.click();

    const modal = page.locator('.task-input-modal-content');
    await expect(modal).toBeVisible();
    await page.waitForTimeout(800);
    await expect(modal).toBeVisible();

    await modal.locator('.close-btn').click();
    await expect(modal).not.toBeVisible();
  }

  const pdfBtn = page.locator('.quick-actions-block .btn-action.secondary', { hasText: 'Exportar PDF' }).first();
  if (await pdfBtn.isVisible()) {
    await pdfBtn.click();
    const pdfModal = page.locator('#pdf-export-modal');
    await expect(pdfModal).toBeVisible();
    await expect(pdfModal.locator('#generate-pdf-btn')).toBeVisible();
    await pdfModal.locator('#cancel-pdf-btn').click();
    await expect(pdfModal).not.toBeVisible();
  }
});
