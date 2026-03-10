import { test, expect } from '@playwright/test';

const groupsResponse = {
  data: [
    {
      id: 1,
      name: 'Equipo Producto',
      owner_id: 101,
      my_role: 'owner',
      member_count: 2,
      invite_code: 'ABCD1234'
    }
  ]
};

const groupDetailResponse = {
  data: {
    id: 1,
    name: 'Equipo Producto',
    description: 'Trabajo colaborativo semanal',
    owner_id: 101,
    my_role: 'owner',
    invite_code: 'ABCD1234',
    group_members: [
      {
        group_id: 1,
        user_id: 101,
        role: 'owner',
        users: {
          id: 101,
          username: 'skillparty',
          name: 'Skill Party',
          avatar_url: '/app.png'
        }
      },
      {
        group_id: 1,
        user_id: 102,
        role: 'member',
        users: {
          id: 102,
          username: 'teammate',
          name: 'Team Mate',
          avatar_url: '/app.png'
        }
      }
    ]
  }
};

const groupTasksResponse = {
  data: [
    {
      id: 9001,
      title: 'Planificar sprint',
      description: 'Definir alcance del sprint',
      date: '2026-03-11',
      completed: false,
      isReminder: true,
      priority: 2,
      group_id: 1,
      task_status: 'todo',
      assigned_to: 102,
      assigned_user: {
        id: 102,
        username: 'teammate',
        name: 'Team Mate',
        avatar_url: '/app.png'
      }
    }
  ]
};

test.describe('Groups view switch', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/groups/1/tasks', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(groupTasksResponse)
      });
    });

    await page.route('**/api/groups/1', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(groupDetailResponse)
      });
    });

    await page.route('**/api/groups', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(groupsResponse)
      });
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem('userSession', JSON.stringify({
        jwt: 'e2e-groups-token',
        user: {
          id: 101,
          username: 'skillparty',
          avatar_url: '/app.png'
        },
        loginTime: Date.now()
      }));
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
  });

  test('switches between Kanban and Calendario in group detail', async ({ page }) => {
    await page.locator('#bottom-groups-btn').click({ force: true });
    await expect(page.locator('#groups-view')).toBeVisible();

    const groupCard = page.locator('.group-card', { hasText: 'Equipo Producto' }).first();
    await expect(groupCard).toBeVisible();
    await groupCard.click();

    const kanbanTab = page.locator('.view-tab', { hasText: 'Kanban' });
    const calendarTab = page.locator('.view-tab', { hasText: 'Calendario' });

    await expect(kanbanTab).toBeVisible();
    await expect(calendarTab).toBeVisible();
    await expect(page.locator('.kanban-board')).toBeVisible();

    await calendarTab.click();
    await expect(page.locator('.group-calendar-shell')).toBeVisible();
    await expect(page.locator('.group-calendar-view')).toBeVisible();
    await expect(page.locator('.group-calendar-view .calendar-grid')).toBeVisible();

    await kanbanTab.click();
    await expect(page.locator('.kanban-board')).toBeVisible();
  });
});
