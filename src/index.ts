import { Hono } from 'hono';
import puppeteer from '@cloudflare/puppeteer';

type Bindings = {
  BROWSER: Fetcher;
};

const app = new Hono<{ Bindings: Bindings }>();

const STATS_URL = 'https://app.gmx.io/stats';
const DASHBOARD_CARDS_SELECTOR = '.DashboardV2-cards';
const DASHBOARD_CARD_ROW_SELECTOR = '.DashboardV2-cards .App-card-row';
const TOOLTIP_SELECTOR = '.Tooltip';
const TOOLTIP_POPUP_SELECTOR = '.Tooltip-popup';
const TOOLTIP_INITIAL_WAIT_MS = 1_000;
const TOOLTIP_POLL_INTERVAL_MS = 250;
const TOOLTIP_TIMEOUT_MS = 5_000;

type Stat = {
  value: string;
  detail: Record<string, string>;
};

app.get('/api/hello', async (c) => {
  const browser = await puppeteer.launch(c.env.BROWSER);

  try {
    const page = await browser.newPage();
    await page.goto(STATS_URL, { waitUntil: 'domcontentloaded', timeout: 25_000 });
    const cards = await page.waitForSelector(DASHBOARD_CARDS_SELECTOR, {
      timeout: 25_000,
    });

    if (!cards) {
      return c.text('Dashboard cards container was not found', 504);
    }

    await new Promise((resolve) => setTimeout(resolve, 25_000));

    const stats = await page.$$eval(
      DASHBOARD_CARD_ROW_SELECTOR,
      (rows) =>
        rows.reduce<Record<string, Stat>>((result, row) => {
          const element = row as unknown as {
            querySelector: (
              selector: string,
            ) => { textContent: string | null } | null;
          };
          const key = element.querySelector('.label')?.textContent?.trim();
          const value = element
            .querySelector('div:last-of-type')
            ?.textContent?.trim();

          if (key && value) {
            result[key] = {
              value,
              detail: {},
            };
          }

          return result;
        }, {}),
    );

    const cardRows = await page.$$(DASHBOARD_CARD_ROW_SELECTOR);

    for (const cardRow of cardRows) {
      const cardKey = await cardRow.evaluate((row) => {
        const element = row as unknown as {
          querySelector: (
            selector: string,
          ) => { textContent: string | null } | null;
        };

        return element.querySelector('.label')?.textContent?.trim() ?? '';
      });

      if (!cardKey || !stats[cardKey]) {
        continue;
      }

      const tooltip = await cardRow.$(TOOLTIP_SELECTOR);

      if (!tooltip) {
        continue;
      }

      await tooltip.hover();
      await new Promise((resolve) =>
        setTimeout(resolve, TOOLTIP_INITIAL_WAIT_MS),
      );

      const startedAt = Date.now();
      let detail: Record<string, string> = {};

      while (Date.now() - startedAt < TOOLTIP_TIMEOUT_MS) {
        const visibleDetails = await page.$$eval(
          TOOLTIP_POPUP_SELECTOR,
          (popups) =>
            popups
              .filter((popup) => {
                const element = popup as unknown as {
                  getBoundingClientRect: () => { width: number; height: number };
                };
                const getStyle = (globalThis as unknown as {
                  getComputedStyle: (target: unknown) => {
                    display: string;
                    visibility: string;
                    opacity: string;
                  };
                }).getComputedStyle;
                const style = getStyle(popup);
                const rect = element.getBoundingClientRect();

                return (
                  style.display !== 'none' &&
                  style.visibility !== 'hidden' &&
                  Number.parseFloat(style.opacity || '1') > 0 &&
                  rect.width > 0 &&
                  rect.height > 0
                );
              })
              .map((popup) => {
                const element = popup as unknown as {
                  querySelectorAll: (
                    selector: string,
                  ) => ArrayLike<{
                    querySelector: (
                      selector: string,
                    ) => { textContent: string | null } | null;
                  }>;
                };

                const rows = Array.from(
                  element.querySelectorAll('.Tooltip-row'),
                );

                return rows.reduce<Record<string, string>>((result, row) => {
                  const key = row.querySelector('.label')?.textContent?.trim();
                  const value = row
                    .querySelector('span:last-of-type')
                    ?.textContent?.trim();

                  if (key && value) {
                    result[key] = value;
                  }

                  return result;
                }, {});
              }),
        );

        const candidate = visibleDetails.find(
          (candidateDetail) => Object.keys(candidateDetail).length > 0,
        );

        if (candidate) {
          detail = candidate;
          break;
        }

        await new Promise((resolve) =>
          setTimeout(resolve, TOOLTIP_POLL_INTERVAL_MS),
        );
      }

      stats[cardKey].detail = detail;
    }

    return c.json(stats);
  } finally {
    await browser.close();
  }
});

export default app;
