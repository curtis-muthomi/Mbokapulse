# MbokaPulse

MbokaPulse is an offline-capable, browser-local research dashboard for recording and reviewing MbokaMan social content, audience comments, and advertising campaign results. Its production service worker caches the app shell and static assets after an online visit; research data is stored in localStorage. It has no backend, account connection, API key, or external AI service.

## Run locally

```sh
npm install
npm run dev
```

The production build is `npm run build`; `npm run lint` runs ESLint.

## Using the workspace

- **Post Analyzer:** manually record a public post URL, metadata, observed metrics, collection date, and notes. The URL is not used to retrieve private metrics or scrape a platform. Open a saved URL from the record details.
- **Comment Intelligence:** paste real comments (one per line) or import a CSV with `comment` or `text` and optional `id`, `post_id`, and `date` columns. The local keyword classifier is preliminary; review and correct sentiment labels.
- **Trends:** compare posts by recorded metrics and filter by date, platform, topic, and content type. Engagement rate uses `(likes + comments + shares) / reach * 100`; where reach is missing and all engagement values plus views are present, the rate uses views as an explicitly labeled alternative. Incomplete metrics are omitted.
- **Ads Research:** record a campaign manually or import a CSV with `campaign_name` (or `name`), `start_date`, and `end_date`. Optional metric columns include `impressions`, `reach`, `clicks`, `spend`, `conversions`, and `engagement`.
- **Reports:** select a reporting period, generate findings from non-demo records, export report CSV, or use browser print / Save as PDF.
- **Data controls:** records persist in localStorage. Export a JSON backup from the sidebar or header. Clear all data or remove only synthetic demo records from Overview.

All figures describe records saved in this browser—not verified platform-wide totals. Blank metrics remain unknown. Synthetic examples are labeled and excluded from generated report findings. Imported campaign and comment records are labeled by source. No passwords, tokens, or private credentials are requested or stored.

## Limitations

MbokaPulse does not connect to social networks or ad accounts and does not automatically collect analytics. Comment classifications rely on an editable keyword list in `src/data.ts`; they can misclassify sarcasm, slang, Sheng, spelling variation, and context. Compare results only when the metric definitions and collection windows are comparable.
