const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="Shop management software for small engine repair shops -- work orders, inventory, invoicing, and a dashboard built for the bench, not the back office.">
<title>Mechanic Shop Hub</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@700;800;900&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap">
<style>
  /* Layout concept: hero framed as a live work-order ticket; sections read
     like a shop-floor diagnostic -- the pain, the fix, the workflow, the
     board, then a direct line to get set up. */
  :root {
    --bg: #f6f8fb;
    --surface: #ffffff;
    --surface-raised: #eef2f8;
    --fg: #10182b;
    --fg-muted: #55617c;
    --fg-faint: #8592ad;
    --border: rgba(16,24,43,0.11);
    --brand: #0f52ba;
    --brand-2: #1d70e2;
    --brand-soft: rgba(15,82,186,0.10);
    --accent: #d9661f;
    --accent-soft: rgba(217,102,31,0.12);
    --good: #1a8a5f;
    --font-display: "Archivo", "Arial Black", sans-serif;
    --font-body: "Inter", -apple-system, sans-serif;
    --font-mono: "JetBrains Mono", ui-monospace, monospace;
    --shadow: 0 1px 2px rgba(16,24,43,0.06), 0 8px 24px -12px rgba(16,24,43,0.18);
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0a0f1c;
      --surface: #111a2c;
      --surface-raised: #17223a;
      --fg: #e7ecf6;
      --fg-muted: #97a3c0;
      --fg-faint: #64729450;
      --border: rgba(231,236,246,0.12);
      --brand: #4e97f0;
      --brand-2: #6fadf5;
      --brand-soft: rgba(78,151,240,0.14);
      --accent: #f08a42;
      --accent-soft: rgba(240,138,66,0.16);
      --good: #3fcf95;
      --shadow: 0 1px 2px rgba(0,0,0,0.3), 0 8px 28px -12px rgba(0,0,0,0.55);
      color-scheme: dark;
    }
  }

  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    background: var(--bg);
    color: var(--fg);
    font-family: var(--font-body);
    padding-left: max(16px, env(safe-area-inset-left, 0px));
    padding-right: max(16px, env(safe-area-inset-right, 0px));
  }
  img { max-width: 100%; }
  h1, h2, h3 { font-family: var(--font-display); line-height: 1.05; text-wrap: balance; margin: 0; }
  p { margin: 0; }
  a { color: inherit; }
  .wrap { max-width: 1080px; margin: 0 auto; }
  .eyebrow {
    font-family: var(--font-mono);
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--brand);
  }

  header {
    position: sticky;
    top: env(safe-area-inset-top, 0px);
    z-index: 20;
    background: color-mix(in srgb, var(--bg) 88%, transparent);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--border);
  }
  .nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 14px 0;
  }
  .brand-mark {
    display: flex;
    align-items: center;
    gap: 9px;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 16.5px;
    letter-spacing: -0.01em;
  }
  .brand-mark .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 8px;
    background: linear-gradient(135deg, var(--brand-2), var(--brand));
    color: #fff;
    flex-shrink: 0;
  }
  .nav-links {
    display: flex;
    align-items: center;
    gap: 26px;
    font-size: 13.5px;
    font-weight: 600;
    color: var(--fg-muted);
  }
  .nav-links a:hover { color: var(--fg); }
  @media (max-width: 720px) { .nav-links .hide-mobile { display: none; } }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 18px;
    border-radius: 9px;
    font-size: 13.5px;
    font-weight: 700;
    text-decoration: none;
    white-space: nowrap;
    border: 1px solid transparent;
    cursor: pointer;
  }
  .btn-primary { background: linear-gradient(135deg, var(--brand-2), var(--brand)); color: #fff; box-shadow: var(--shadow); }
  .btn-primary:hover { filter: brightness(1.06); }
  .btn-ghost { border-color: var(--border); color: var(--fg); background: var(--surface); }
  .btn-ghost:hover { background: var(--surface-raised); }

  .hero {
    padding: 64px 0 56px;
    display: grid;
    grid-template-columns: 1.05fr 0.95fr;
    gap: 48px;
    align-items: center;
  }
  @media (max-width: 860px) { .hero { grid-template-columns: 1fr; padding: 40px 0 36px; gap: 34px; } }

  .hero h1 { font-size: clamp(32px, 5vw, 48px); font-weight: 900; letter-spacing: -0.01em; margin-top: 10px; }
  .hero .accent-word { color: var(--brand); }
  .hero p.lede { margin-top: 16px; font-size: 16.5px; line-height: 1.6; color: var(--fg-muted); max-width: 46ch; }
  .hero-ctas { display: flex; gap: 12px; margin-top: 26px; flex-wrap: wrap; }
  .hero-note { margin-top: 14px; font-size: 12.5px; color: var(--fg-faint); font-family: var(--font-mono); }

  .ticket {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    box-shadow: var(--shadow);
    overflow: hidden;
  }
  .ticket-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px;
    border-bottom: 1px solid var(--border);
    background: var(--surface-raised);
  }
  .ticket-id { font-family: var(--font-mono); font-size: 12.5px; font-weight: 700; color: var(--fg-muted); }
  .ticket-live { display: flex; align-items: center; gap: 6px; font-family: var(--font-mono); font-size: 11px; font-weight: 700; color: var(--good); text-transform: uppercase; letter-spacing: 0.06em; }
  .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--good); animation: pulse 1.8s ease-in-out infinite; }
  @media (prefers-reduced-motion: reduce) { .dot { animation: none; } }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }

  .ticket-body { padding: 18px; }
  .ticket-row { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; padding: 7px 0; border-bottom: 1px dashed var(--border); }
  .ticket-row:last-of-type { border-bottom: none; }
  .ticket-row .k { color: var(--fg-faint); }
  .ticket-row .v { font-weight: 600; text-align: right; }

  .pipeline { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 16px; }
  .step {
    font-family: var(--font-mono);
    font-size: 10.5px;
    font-weight: 700;
    padding: 6px 9px;
    border-radius: 999px;
    border: 1px solid var(--border);
    color: var(--fg-faint);
    background: var(--surface-raised);
  }
  .step.done { color: var(--good); border-color: color-mix(in srgb, var(--good) 40%, transparent); background: color-mix(in srgb, var(--good) 10%, var(--surface)); }
  .step.active { color: #fff; background: linear-gradient(135deg, var(--brand-2), var(--brand)); border-color: transparent; }

  section { padding: 52px 0; border-top: 1px solid var(--border); }
  .section-head { max-width: 60ch; margin-bottom: 32px; }
  .section-head h2 { font-size: clamp(24px, 3.4vw, 32px); font-weight: 800; margin-top: 8px; }
  .section-head p { margin-top: 10px; font-size: 14.5px; color: var(--fg-muted); line-height: 1.6; }

  .pain-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
  @media (max-width: 800px) { .pain-grid { grid-template-columns: 1fr; } }
  .pain-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 13px;
    padding: 18px;
  }
  .pain-card .tag { font-family: var(--font-mono); font-size: 10.5px; font-weight: 700; color: var(--accent); text-transform: uppercase; letter-spacing: 0.06em; }
  .pain-card p { margin-top: 8px; font-size: 14px; line-height: 1.55; color: var(--fg); }

  .feature-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px; background: var(--border); border: 1px solid var(--border); border-radius: 14px; overflow: hidden; }
  @media (max-width: 800px) { .feature-grid { grid-template-columns: 1fr; } }
  .feature {
    background: var(--surface);
    padding: 22px 20px;
  }
  .feature .icon-wrap {
    width: 34px; height: 34px; border-radius: 9px;
    display: flex; align-items: center; justify-content: center;
    background: var(--brand-soft); color: var(--brand); margin-bottom: 14px;
  }
  .feature h3 { font-size: 15.5px; font-weight: 700; }
  .feature p { margin-top: 7px; font-size: 13.3px; line-height: 1.55; color: var(--fg-muted); }

  .workflow { display: flex; align-items: stretch; gap: 0; overflow-x: auto; padding-bottom: 6px; }
  .wf-step { flex: 1 0 150px; padding: 16px 16px 16px 0; position: relative; }
  .wf-step .n { font-family: var(--font-mono); font-size: 11px; font-weight: 700; color: var(--fg-faint); }
  .wf-step h3 { font-size: 14.5px; font-weight: 700; margin-top: 6px; }
  .wf-step p { font-size: 12.5px; color: var(--fg-muted); margin-top: 5px; line-height: 1.5; }
  .wf-step:not(:last-child)::after {
    content: "";
    position: absolute; top: 24px; right: 0;
    width: 100%; height: 1px;
    background: repeating-linear-gradient(90deg, var(--border) 0 6px, transparent 6px 11px);
  }

  .board {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    box-shadow: var(--shadow);
    padding: 20px;
  }
  .board-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
  .board-head .t { font-family: var(--font-mono); font-size: 11px; font-weight: 700; color: var(--fg-faint); text-transform: uppercase; letter-spacing: 0.06em; }
  .tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  @media (max-width: 700px) { .tiles { grid-template-columns: repeat(2, 1fr); } }
  .tile { background: var(--surface-raised); border: 1px solid var(--border); border-radius: 11px; padding: 13px; }
  .tile .lbl { font-family: var(--font-mono); font-size: 10px; font-weight: 700; color: var(--fg-faint); text-transform: uppercase; letter-spacing: 0.05em; }
  .tile .val { font-family: var(--font-mono); font-size: 20px; font-weight: 700; margin-top: 6px; }
  .tile .sub { font-size: 11px; color: var(--good); margin-top: 3px; font-weight: 600; }
  .tile .sub.warn { color: var(--accent); }
  .board-note { margin-top: 12px; font-size: 11.5px; color: var(--fg-faint); font-family: var(--font-mono); }

  .cta-panel {
    background: linear-gradient(135deg, var(--brand), var(--brand-2));
    border-radius: 18px;
    padding: 40px 36px;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    flex-wrap: wrap;
  }
  .cta-panel h2 { font-size: clamp(22px, 3vw, 28px); font-weight: 800; }
  .cta-panel p { margin-top: 8px; font-size: 14px; opacity: 0.92; max-width: 42ch; }
  .cta-panel .btn-ghost { background: #fff; color: var(--brand); border-color: transparent; }
  .contact-line { margin-top: 14px; font-family: var(--font-mono); font-size: 12.5px; opacity: 0.88; }
  .contact-line strong { user-select: all; }

  footer { padding: 28px 0 40px; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; font-size: 12px; color: var(--fg-faint); }
  footer .brand-mark { font-size: 13px; }
  footer .brand-mark .badge { width: 22px; height: 22px; border-radius: 6px; }
</style>
</head>
<body>

<header>
  <div class="wrap nav">
    <div class="brand-mark">
      <span class="badge" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L2.5 18.5a1.5 1.5 0 0 0 2 2l6.8-6.8a4 4 0 0 0 5.4-5.4l-2.5 2.5-2-2 2.5-2.5z"/></svg>
      </span>
      Mechanic Shop Hub
    </div>
    <nav class="nav-links">
      <a href="#pain" class="hide-mobile">Why</a>
      <a href="#features" class="hide-mobile">Features</a>
      <a href="#workflow" class="hide-mobile">How it works</a>
      <a href="#contact" class="btn btn-primary">Get set up</a>
    </nav>
  </div>
</header>

<main class="wrap">
  <section class="hero" style="border-top: none;">
    <div>
      <span class="eyebrow">Shop management, built shop-floor-first</span>
      <h1>Run the bench, the parts room,<br>and the books <span class="accent-word">from one screen.</span></h1>
      <p class="lede">Mechanic Shop Hub replaces the whiteboard, the spreadsheet, and the shoebox of receipts with one system built specifically for small engine repair &mdash; mowers, chainsaws, trimmers, generators, and everything with a carb kit.</p>
      <div class="hero-ctas">
        <a href="#contact" class="btn btn-primary">Get set up</a>
        <a href="#workflow" class="btn btn-ghost">See how it works</a>
      </div>
      <p class="hero-note">// built with a working small engine repair shop, running day to day</p>
    </div>

    <div class="ticket" role="img" aria-label="Example work order ticket showing a repair moving through the shop's status pipeline">
      <div class="ticket-head">
        <span class="ticket-id">WO-1042</span>
        <span class="ticket-live"><span class="dot"></span>On the bench</span>
      </div>
      <div class="ticket-body">
        <div class="ticket-row"><span class="k">Customer</span><span class="v">R. Gallant</span></div>
        <div class="ticket-row"><span class="k">Equipment</span><span class="v">Yardworks / Briggs &middot; 4-stroke, 173cc</span></div>
        <div class="ticket-row"><span class="k">Complaint</span><span class="v">Won't hold idle</span></div>
        <div class="ticket-row"><span class="k">Assigned</span><span class="v">J. Arsenault</span></div>
        <div class="pipeline">
          <span class="step done">Dropped Off</span>
          <span class="step done">Diagnosing</span>
          <span class="step done">Approved</span>
          <span class="step active">In Repair</span>
          <span class="step">Ready for Pickup</span>
        </div>
      </div>
    </div>
  </section>

  <section id="pain">
    <div class="section-head">
      <span class="eyebrow">The problem</span>
      <h2>You already know where the day goes missing.</h2>
      <p>None of it is one big problem. It's a dozen small ones, every single day.</p>
    </div>
    <div class="pain-grid">
      <div class="pain-card">
        <span class="tag">The whiteboard</span>
        <p>Three mowers are "almost done" and nobody can say which one, or what they're waiting on.</p>
      </div>
      <div class="pain-card">
        <span class="tag">The parts wall</span>
        <p>You reorder spark plugs from memory and find out you're out of belts mid-repair.</p>
      </div>
      <div class="pain-card">
        <span class="tag">The invoice pile</span>
        <p>A customer picks up their trimmer and you're hand-writing the total, tax included, on a pad.</p>
      </div>
    </div>
  </section>

  <section id="features">
    <div class="section-head">
      <span class="eyebrow">What it does</span>
      <h2>Everything the shop already does &mdash; just not on paper.</h2>
    </div>
    <div class="feature-grid">
      <div class="feature">
        <span class="icon-wrap"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></span>
        <h3>Work orders &amp; the bench</h3>
        <p>Every repair moves through the same pipeline &mdash; dropped off, diagnosing, awaiting approval, in repair, ready for pickup &mdash; so anyone can see what's stuck and why.</p>
      </div>
      <div class="feature">
        <span class="icon-wrap"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7 12 3 4 7v10l8 4 8-4V7Z"/><path d="M4 7l8 4 8-4M12 11v10"/></svg></span>
        <h3>Parts &amp; inventory</h3>
        <p>SKUs, bin locations, cost and sell price, and a low-stock flag before you're mid-repair without a belt.</p>
      </div>
      <div class="feature">
        <span class="icon-wrap"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2v4M15 2v4M4 10h16M5 6h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z"/></svg></span>
        <h3>Customers &amp; equipment</h3>
        <p>Every machine's full history &mdash; every visit, every part, every invoice &mdash; against the customer who owns it.</p>
      </div>
      <div class="feature">
        <span class="icon-wrap"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v16H4zM8 9h8M8 13h5"/></svg></span>
        <h3>Itemized invoicing</h3>
        <p>Labor, parts, and tax calculated automatically, sent as a branded PDF with a link the customer can view online.</p>
      </div>
      <div class="feature">
        <span class="icon-wrap"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18M8 17V10M13 17V6M18 17v-4"/></svg></span>
        <h3>A dashboard that loads instantly</h3>
        <p>What's on the bench, what's overdue, what's low on the shelf &mdash; the moment you open it each morning.</p>
      </div>
      <div class="feature">
        <span class="icon-wrap"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/><path d="M4 21a8 8 0 0 1 16 0"/></svg></span>
        <h3>Roles for the whole crew</h3>
        <p>Front desk, technicians, and the owner each see exactly what their job needs &mdash; no more, no less.</p>
      </div>
    </div>
  </section>

  <section id="workflow">
    <div class="section-head">
      <span class="eyebrow">How it works</span>
      <h2>One ticket, start to finish.</h2>
    </div>
    <div class="workflow">
      <div class="wf-step"><span class="n">01</span><h3>Intake</h3><p>Log the customer, the equipment, and what they told you was wrong.</p></div>
      <div class="wf-step"><span class="n">02</span><h3>Diagnose</h3><p>A tech adds notes and builds the estimate right on the ticket.</p></div>
      <div class="wf-step"><span class="n">03</span><h3>Approve</h3><p>The customer signs off before a wrench touches the machine.</p></div>
      <div class="wf-step"><span class="n">04</span><h3>Repair</h3><p>Parts get pulled from stock and logged against the job automatically.</p></div>
      <div class="wf-step"><span class="n">05</span><h3>Pick up &amp; paid</h3><p>One invoice, taxed correctly, closes the ticket.</p></div>
    </div>
  </section>

  <section>
    <div class="section-head">
      <span class="eyebrow">Every morning</span>
      <h2>Open the app, see the shop.</h2>
      <p>An illustrative look at the kind of numbers waiting for you &mdash; not this shop's real figures.</p>
    </div>
    <div class="board">
      <div class="board-head"><span class="t">Dashboard &middot; This morning</span></div>
      <div class="tiles">
        <div class="tile"><div class="lbl">On the bench</div><div class="val">7</div><div class="sub">2 awaiting approval</div></div>
        <div class="tile"><div class="lbl">Ready for pickup</div><div class="val">3</div><div class="sub warn">1 aging &gt;14d</div></div>
        <div class="tile"><div class="lbl">Revenue, this month</div><div class="val">$8,240</div><div class="sub">&uarr; 12% vs last month</div></div>
        <div class="tile"><div class="lbl">Low stock parts</div><div class="val">4</div><div class="sub warn">reorder soon</div></div>
      </div>
      <p class="board-note">// same numbers your Customer 360 and reports already track &mdash; just surfaced before you ask</p>
    </div>
  </section>

  <section id="contact">
    <div class="cta-panel">
      <div>
        <h2>Built for one shop. Ready for yours.</h2>
        <p>Mechanic Shop Hub started as the system running a real small engine repair shop's daily work. Tell us about yours and we'll get you set up.</p>
        <p class="contact-line">Email <strong>hello@mechanicsrepairhub.com</strong></p>
      </div>
      <a href="mailto:hello@mechanicsrepairhub.com?subject=Setting%20up%20Mechanic%20Shop%20Hub" class="btn btn-ghost">Get set up</a>
    </div>
  </section>
</main>

<footer class="wrap">
  <div class="brand-mark">
    <span class="badge" aria-hidden="true">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L2.5 18.5a1.5 1.5 0 0 0 2 2l6.8-6.8a4 4 0 0 0 5.4-5.4l-2.5 2.5-2-2 2.5-2.5z"/></svg>
    </span>
    Mechanic Shop Hub
  </div>
  <span>&copy; 2026 Mechanic Shop Hub &middot; app.mechanicsrepairhub.com</span>
</footer>
</body>
</html>
`;

export function GET() {
  return new Response(PAGE, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
