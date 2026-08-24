import { expect, test } from '@playwright/test';
import { login } from './helpers';

const staticAuthenticatedRoutes = [
  '/app',
  '/app/research',
  '/app/research/lifecycle',
  '/app/research/data-analysis',
  '/app/research/paths',
  '/app/research/decisions',
  '/app/research/planning',
  '/app/research/study-design/measurement',
  '/app/research/study-design/analysis-plan',
  '/app/research/wizard',
  '/app/research/study-design/analyzer',
  '/app/research/study-design/consistency',
  '/app/research/study-design/model',
  '/app/research/study-design/sample',
  '/app/research/simulation/lab',
  '/app/research/simulation/predictor',
  '/app/research/field/data-quality',
  '/app/research/field/pre-registration',
  '/app/research/field/monitoring',
  '/app/research/literature/synthesizer',
  '/app/research/literature/prisma',
  '/app/research/literature/qualitative',
  '/app/research/progress',
  '/app/research/study-design/assistant',
  '/app/publishing',
  '/app/publishing/review',
  '/app/publishing/export',
  '/app/peer-review',
  '/app/peer-review/assignments',
  '/app/promotion',
  '/app/promotion/regulations',
  '/app/visibility',
  '/app/visibility/audit',
  '/app/visibility/plan',
  '/app/visibility/reports',
  '/app/profile',
  '/app/profile/identifiers',
  '/app/profile/affiliations',
  '/app/assets',
  '/app/search',
  '/saas/workspaces',
  '/saas/billing',
] as const;

const viewports = [
  { name: 'small-phone', width: 320, height: 568 },
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'widescreen', width: 2560, height: 1440 },
] as const;

for (const viewport of viewports) {
  test(`@responsive every static authenticated page fits ${viewport.name}`, async ({ page }) => {
    test.setTimeout(4 * 60_000);
    await page.setViewportSize(viewport);
    await login(page);

    for (const route of staticAuthenticatedRoutes) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('main'), `${viewport.name} ${route} should render its main landmark`).toHaveCount(1);

      await expect.poll(async () => page.evaluate(() =>
        document.documentElement.scrollWidth <= window.innerWidth,
      ).catch(() => false), {
        message: `${viewport.name} ${route} must not create horizontal page overflow`,
      }).toBe(true);
    }
  });
}
