import { test, expect } from '@playwright/test';

/**
 * Helper to create a task via UI
 * @param {import('@playwright/test').Page} page
 * @param {string} title
 */
async function createTask(page, title) {
  // Ensure we are on calendar view
  if (!(await page.locator('#calendar-view').isVisible())) {
    await page.locator('#calendar-btn').click();
  }
  
  // Click today
  const todayCell = page.locator('.day.today');
  await todayCell.hover();
  // Try clicking the add button directly if visible, else the day cell then add button
  if (await todayCell.locator('.day-add-btn').isVisible()) {
    await todayCell.locator('.day-add-btn').click();
  } else {
    // Click day content to open day modal, then add
    await todayCell.locator('.day-content').click();
    await page.locator('#add-task-modal-btn').click();
  }

  const modal = page.locator('.task-input-modal-content');
  await expect(modal).toBeVisible();
  
  await modal.locator('#task-title-input').fill(title);
  await modal.locator('.task-input-save-btn').click();
  await expect(modal).not.toBeVisible();
  
  // Verify it appears in grid immediately
  await expect(todayCell.locator('.task-preview-item', { hasText: title })).toBeVisible();
}

test.describe('Calendar10 Critical Flows', () => {
  test.beforeEach(async ({ page }) => {
    // Listen for console logs
    page.on('console', msg => console.log(`BROWSER LOG: ${msg.text()}`));
    page.on('pageerror', err => console.log(`BROWSER ERROR: ${err.message}`));

    // Clear localStorage (use evaluate instead of addInitScript to avoid clearing on reload)
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload(); // Reload to ensure clean state
  });

  test('should create a task and see it in calendar', async ({ page }) => {
    await createTask(page, 'Test Task E2E');
    // Helper already verifies visibility
    await page.reload();
  });

  test('should verify task in agenda and inline edit', async ({ page }) => {
    await createTask(page, 'Initial Title');
    
    await page.waitForTimeout(500); 
    await page.reload(); 

    // Switch to Agenda
    await page.locator('#agenda-btn').click();
    await expect(page.locator('#agenda-view')).toBeVisible();

    // Find task card and open edit modal
    const card = page.locator('.task-card', { hasText: 'Initial Title' }).first();
    await expect(card).toBeVisible();
    await card.locator('button[title="Editar"]').click();

    // Edit title in modal
    const editModal = page.locator('.task-input-modal-content');
    await expect(editModal).toBeVisible();
    await editModal.locator('#task-title-input').fill('Edited Title E2E');
    await editModal.locator('.task-input-save-btn').click();
    await expect(editModal).not.toBeVisible();

    // Verify change
    await expect(page.locator('.task-card-title', { hasText: 'Edited Title E2E' })).toBeVisible();
  });

  test('should persist task completion status', async ({ page }) => {
    await createTask(page, 'Completion Test');
    await page.waitForTimeout(500);
    
    // Go to Agenda
    await page.locator('#agenda-btn').click();
    await expect(page.locator('#agenda-view')).toBeVisible();
    
    // Find the task card
    const card = page.locator('.task-card', { hasText: 'Completion Test' }).first();
    await expect(card).toBeVisible();
    
    // Click toggle button
    const toggleBtn = card.locator('.task-checkbox');
    await toggleBtn.click();
    
    // Verify UI updates immediately
    await expect(card).toHaveClass(/completed/);
    
    // Reload page to test persistence
    await page.reload();
    await page.locator('#agenda-btn').click();
    
    // Verify still completed
    const cardAfter = page.locator('.task-card', { hasText: 'Completion Test' }).first();
    await expect(cardAfter).toHaveClass(/completed/);
    await expect(cardAfter.locator('.task-checkbox .icon-completed')).toBeVisible();
  });

  test('should delete task from Day Modal', async ({ page }) => {
    await createTask(page, 'Day Delete');
    await page.reload();
    
    // Open Day Modal by clicking the day content
    const todayCellContent = page.locator('.day.today .day-content');
    await todayCellContent.locator('.day-number').click();
    
    const dayModal = page.locator('.modal-content', { has: page.locator('#add-task-modal-btn') });
    await expect(dayModal).toBeVisible();
    
    const taskItem = dayModal.locator('.task-card', { hasText: 'Day Delete' });
    await expect(taskItem).toBeVisible();
    
    const deleteBtn = taskItem.locator('button[title="Eliminar"]');
    page.once('dialog', dialog => dialog.accept());
    await deleteBtn.click();
    
    // Verify toast using accessible role
    const toast = page.getByRole('alert');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('eliminada');
    
    // Undo
    await toast.locator('button', { hasText: 'Deshacer' }).click();
    
    // Verify task restoration in the same day modal
    await expect(dayModal.locator('.task-card', { hasText: 'Day Delete' })).toBeVisible();
  });
});
