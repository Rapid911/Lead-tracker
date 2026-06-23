# Pipeline — Momentum Tracker

An offline lead/follow-up tracker for field sales. No backend, no
sign-in — your leads live on your phone in local storage, and the
app keeps working with zero signal once it's loaded once.

## What it does

- Logs each lead with vehicle, financing type, source, phone, notes.
- Runs the 5-stage follow-up cadence automatically:
  same-day recap → 48–72h check-in → new-value follow-up →
  surface-the-objection → monthly nurture. Tap **"Mark contacted
  today"** and it calculates the next due date for you.
- Dashboard up top shows Overdue / Due today / Upcoming / Disbursed
  at a glance.
- One-tap **Call** and **WhatsApp** buttons on every lead.
- **Export backup** / **Import backup** — since data is local to
  the device, back it up to a `.json` file every so often (email it
  to yourself, save to Drive, whatever's easiest).

## Deploy it (so it has a real URL and can be installed)

1. Push this folder to a new GitHub repo (same flow you've used for
   your portfolio and the birthday site):
   ```
   git init
   git add .
   git commit -m "Pipeline tracker"
   git branch -M main
   git remote add origin https://github.com/<you>/pipeline-tracker.git
   git push -u origin main
   ```
2. Go to [vercel.com](https://vercel.com), **Add New → Project**,
   import that repo. No build settings needed — it's plain
   HTML/CSS/JS, so leave the framework preset as "Other" and deploy.
3. Vercel gives you a URL like `pipeline-tracker.vercel.app`.

## Install it on your phone

**Android (Chrome):**
Open the Vercel URL → tap the **⋮** menu → **Add to Home screen** /
**Install app**. It now opens full-screen like a normal app, with
its own icon, and works offline after the first open.

**iPhone (Safari):**
Open the URL → tap the **Share** icon → **Add to Home Screen**.
iOS PWAs are a bit more limited offline than Android, but the app
shell and your saved leads still work without signal since
everything is cached and stored locally.

## A few honest limitations

- **Local storage is per-device.** If you switch phones, export a
  backup first and import it on the new one — there's no cloud
  sync. If you ever want that (e.g. syncing across your phone and
  laptop), that's a bigger step up — happy to help when you're ready.
- **Clearing your browser data wipes it too.** Get in the habit of
  exporting a backup weekly, same as you'd back up anything else
  important.
- The cadence days (3 / 7 / 14 / 30) are editable — open `app.js`
  and change the `CADENCE` array near the top if you want to tune
  the rhythm later.
