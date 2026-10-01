// Shared presentation only. Service boundaries, child cards and controls stay in
// family-hub-card. The Home Assistant appearance setting selects the palette.
export const DAILY_BRIEF_STYLES = `
  .hub-card {
    --daily-background:#F6F7F3; --daily-surface:#FFFFFF; --daily-sidebar:#EDF1E9;
    --daily-text:#22332B; --daily-muted:#59695F; --daily-line:#DDE4DC;
    --daily-soft:#F0F3ED; --daily-accent:#2D5C49; --daily-accent-soft:#E6EFE4;
    --daily-accent-line:#BCD0BD; --daily-on-accent:#FFFFFF;
    --daily-strong:#315943; --daily-strong-end:#274A39; --daily-on-strong:#FFFFFF;
    --daily-strong-muted:#D4E4D9; --daily-strong-accent:#B9DDC1;
    --daily-warning:#755211; --daily-warning-soft:#FFF5DB; --daily-warning-line:#E5D3A3;
    --daily-danger:#A83435; --daily-danger-soft:#FFF0EC; --daily-danger-line:#E8BCB4;
    --daily-success:#246545; --daily-success-soft:#EDF6EE; --daily-success-line:#BBD8C1;
    --daily-shadow:0 5px 24px rgba(34,51,43,.035);
    --hub-accent:var(--daily-accent) !important; --hub-background:var(--daily-background) !important;
    --hub-surface:var(--daily-surface) !important; --hub-text:var(--daily-text) !important;
    --hub-muted:var(--daily-muted) !important; --hub-nav:var(--daily-sidebar) !important;
    --hub-focus:var(--daily-accent); --hub-radius:22px;
    --primary-text-color:var(--daily-text); --secondary-text-color:var(--daily-muted);
    --ha-card-background:var(--daily-surface); --card-background-color:var(--daily-surface);
    --primary-color:var(--daily-accent); --accent-color:var(--daily-accent);
    --divider-color:var(--daily-line);
    color-scheme:light; font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  }
  .hub-card[data-appearance="dark"] {
    --daily-background:#141C17; --daily-surface:#202B23; --daily-sidebar:#19241D;
    --daily-text:#EDF4EE; --daily-muted:#B1C1B5; --daily-line:#3A4B3F;
    --daily-soft:#27352B; --daily-accent:#B0DCC0; --daily-accent-soft:#304937;
    --daily-accent-line:#5C8166; --daily-on-accent:#183020;
    --daily-strong:#294D37; --daily-strong-end:#223E2D;
    --daily-warning:#F4D38C; --daily-warning-soft:#433821; --daily-warning-line:#77613C;
    --daily-danger:#FFB6AD; --daily-danger-soft:#482C2A; --daily-danger-line:#80504A;
    --daily-success:#B0DEBC; --daily-success-soft:#294533; --daily-success-line:#547A5C;
    --daily-shadow:0 5px 24px rgba(0,0,0,.10); color-scheme:dark;
  }
  .hub-card,.hub-shell,.hub-content { background:var(--daily-background); color:var(--daily-text); }
  .hub-shell { grid-template-columns:160px minmax(0,1fr); }
  .hub-navigation { padding:22px 12px; gap:12px; background:var(--daily-sidebar); border-right:1px solid var(--daily-line); box-shadow:none; }
  .hub-wordmark { min-height:54px; margin:0 8px 14px; display:flex; align-items:center; gap:10px; color:var(--daily-text); }
  .hub-wordmark ha-icon { --mdc-icon-size:22px; color:var(--daily-accent); }
  .hub-wordmark span { font-size:24px; line-height:.96; letter-spacing:-.06em; font-weight:750; }
  .hub-brand,.hub-nav-button { width:100%; min-height:48px; height:auto; margin:0; padding:10px 12px; display:flex; flex-direction:row; align-items:center; justify-content:flex-start; gap:10px; border:0; border-radius:12px; background:transparent; color:var(--daily-text); box-shadow:none; text-align:left; }
  .hub-brand ha-icon,.hub-nav-button ha-icon { flex:0 0 21px; --mdc-icon-size:21px; }
  .hub-brand span,.hub-nav-button span { font-size:14px; line-height:1.2; font-weight:500; }
  .hub-brand.is-active,.hub-nav-button.is-active { background:var(--daily-accent-soft); color:var(--daily-text); box-shadow:none; }
  .hub-brand.is-active span,.hub-nav-button.is-active span { font-weight:700; }
  .hub-nav-items,.hub-nav-core,.hub-nav-utility { flex:0 0 auto; margin:0; justify-content:flex-start; gap:3px; }
  .hub-nav-label { padding:9px 12px 4px; color:var(--daily-muted); font-size:12px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; white-space:nowrap; }
  .hub-content { padding:16px 24px 24px; grid-template-rows:56px minmax(0,1fr); gap:14px; }
  .hub-page-title { align-items:flex-start; flex-direction:column; gap:6px; }
  .hub-topbar h1 { font-size:28px; letter-spacing:-.045em; font-weight:750; }
  .hub-topbar-date { font-size:12px; font-weight:500; }
  .hub-topbar-time { min-width:60px; font-size:22px; font-weight:650; }
  .hub-weather-pill { min-height:48px; padding:0 12px; border:0; border-radius:14px; background:var(--daily-surface); color:var(--daily-text); box-shadow:none; font-size:13px; font-weight:500; }
  .hub-weather-pill ha-icon { color:var(--daily-warning); }
  .surface { border:1px solid var(--daily-line); background:var(--daily-surface); color:var(--daily-text); border-radius:22px; box-shadow:var(--daily-shadow); }
  .surface h2,.surface h3,.surface strong { color:var(--daily-text); }
  .eyebrow,.surface .eyebrow { color:var(--daily-muted); font-weight:650; letter-spacing:.11em; }
  .section-heading h2 { font-size:22px; letter-spacing:-.035em; font-weight:650; }
  .section-heading > button,.text-action { color:var(--daily-accent); font-weight:600; }
  .icon-action,.scene-button,.camera-select-action { background:var(--daily-accent-soft); color:var(--daily-accent); }
  .segment.is-selected,.calendar-add-event,.garage-action,.calendar-modal-save,.planner-save { background:var(--daily-accent); color:var(--daily-on-accent); box-shadow:none; }
  .segments,.home-segments { background:var(--daily-soft); }
  .segment { font-weight:600; }
  .today-grid,.today-grid:has(.today-football[data-fixture-count="3"]),.today-grid:has(.today-football[data-fixture-count="4"]) { height:auto; min-height:0; grid-template-columns:repeat(6,minmax(0,1fr)); grid-template-rows:auto auto auto; align-content:start; gap:18px; }
  .today-grid article { padding:18px; overflow:visible; }
  .hero-panel.today-hero { grid-column:1/5; grid-row:1; grid-template-columns:116px minmax(0,1fr); grid-template-rows:auto auto; gap:16px 14px; align-content:center; padding:10px 0 4px; border:0; background:transparent; color:var(--daily-text); box-shadow:none; }
  .today-hero::after { content:none; }
  .today-hero-copy { grid-column:1/-1; align-self:start; }
  .today-hero .eyebrow { color:var(--daily-muted); }
  .today-hero h2 { margin:10px 0 0; color:var(--daily-text); font-size:46px; line-height:1.04; font-weight:750; letter-spacing:-.055em; }
  .today-hero-copy > p:last-child { margin-top:12px; color:var(--daily-muted); font-size:15px; }
  .daily-home-art { grid-row:2; grid-column:1; align-self:stretch; min-height:100px; overflow:hidden; border-radius:16px; background:var(--daily-soft); }
  .daily-home-art img { display:block; width:100%; height:100%; object-fit:cover; }
  .hero-metrics,.hero-metrics.has-energy { grid-row:2; grid-column:2; margin:0; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
  .hero-metrics[data-metric-count="1"] { grid-template-columns:minmax(0,1fr); }
  .today-hero:not(:has(.daily-home-art)) .hero-metrics { grid-column:1/-1; }
  .hero-metrics button { min-height:54px; padding:8px 10px; gap:8px; border:0; border-radius:12px; background:var(--daily-soft); color:var(--daily-text); }
  .hero-metrics button > ha-icon { --mdc-icon-size:20px; color:var(--daily-accent); }
  .hero-metrics strong { color:var(--daily-text); font-size:14px; font-weight:650; }
  .hero-metrics small { color:var(--daily-muted); font-size:12px; line-height:1.3; }
  .today-next { grid-column:5/7; grid-row:1; min-height:236px; padding:20px !important; border:0; background:var(--daily-accent-soft); box-shadow:none; }
  .today-card-icon { margin-bottom:14px; background:var(--daily-surface); color:var(--daily-accent); }
  .today-next h2 { font-size:27px; letter-spacing:-.04em; font-weight:650; overflow-wrap:anywhere; }
  .today-next .today-card-icon { width:40px; height:40px; margin-bottom:10px; }
  .today-next .text-action { margin-top:12px; }
  .today-family { grid-row:2; grid-column:1/4; }
  .today-football { grid-row:2; grid-column:4/7; }
  .today-music { grid-row:3; grid-column:1/-1; }
  .today-grid[data-secondary-count="0"] .today-hero,.today-grid[data-secondary-count="0"] .today-next { grid-row:1; }
  .today-grid[data-calendar="false"] .today-hero { grid-column:1/-1; }
  .today-grid[data-secondary-count="1"] .today-secondary { grid-column:1/-1 !important; grid-row:2; }
  .today-grid[data-secondary-count="2"] .today-secondary { grid-column:span 3 !important; grid-row:2; }
  .today-family,.today-football,.today-music { justify-content:flex-start; background:var(--daily-surface); }
  .today-music { display:grid; grid-template-columns:minmax(160px,.7fr) minmax(0,1fr); align-items:center; gap:20px; }
  .today-music .section-heading { align-items:center; }
  .today-music { padding:12px 18px !important; }
  .today-music .now-playing { grid-template-columns:52px minmax(0,1fr) 48px; }
  .today-music .artwork { width:52px; height:52px; }
  .today-music .now-playing,.today-music .quiet-music { margin:0; min-height:52px; }
  .person-summary { border:0; min-height:68px; background:color-mix(in srgb,var(--person-colour) 5%,var(--daily-soft)); border-radius:14px; }
  .person-summary strong { font-size:15px; }
  .person-initial { border:0; background:color-mix(in srgb,var(--person-colour) 25%,#263A2E); color:#FFFFFF; }
  .compact-fixture { border:0; border-left:3px solid var(--daily-line); min-height:74px; background:var(--daily-soft); border-radius:12px; box-shadow:none; }
  .compact-fixture:not(.is-empty) { padding:6px 10px; gap:2px 8px; }
  .compact-fixture.is-derby { background:var(--daily-soft); border-right:3px solid #670E36; border-left:3px solid #132257; }
  .compact-team { font-size:13px; }
  .team-mark,.team-mark img { background:#FFFFFF; color:#22332B; }
  .team-mark { box-shadow:none; }
  .team-mark strong { color:#22332B; }
  .home-toolbar h2 { font-size:22px; letter-spacing:-.035em; }
  .home-segments { max-width:100%; }
  .home-toolbar { flex-wrap:wrap; gap:14px; }
  .home-surface { grid-template-rows:auto minmax(0,1fr); }
  .home-summary-links button { box-shadow:none; border-radius:16px; }
  .floorplan-canvas { background:var(--daily-soft); }
  .room-detail.home-drawer { background:var(--daily-surface); }
  .room-icon,.whole-home-heading > span,.heating-card-heading > span,.cover-card-heading > span { background:var(--daily-accent-soft); color:var(--daily-accent); }
  .room-title h2 { font-size:26px; letter-spacing:-.04em; }
  .lighting-master,.heating-master,.energy-hero,.football-favourites-stage { background:var(--daily-strong); border:0; color:var(--daily-on-strong); box-shadow:none; }
  .lighting-master h2,.heating-master h2,.energy-hero h2,.football-favourites-stage h2 { color:var(--daily-on-strong); font-weight:650; letter-spacing:-.035em; }
  .lighting-master .eyebrow,.heating-master .eyebrow,.heating-master-target { color:var(--daily-strong-muted); }
  .master-temperature-stepper button { color:var(--daily-on-strong); }
  .master-schedule summary > span ha-icon { color:var(--daily-strong-accent); }
  .lighting-master button,.heating-master-actions button,.schedule-editor > button { background:var(--daily-on-strong); color:var(--daily-strong); border:0; }
  .heating-grid .surface,.whole-home-card,.cover-card { box-shadow:none; }
  .whole-home-card::before { height:2px; }
  .security-stage { background:#1E352A; box-shadow:none; }
  .security-stage h2 { color:#FFFFFF; }
  .security-stage .camera-stage-action b,.camera-idle button { background:#BCDCC4; color:#1E352A; }
  .football-favourites-stage::after { content:none; }
  .favourite-hero-card { box-shadow:none; }
  .favourite-standing b { color:var(--daily-text); }
  .fpl-scoreboard small,.fpl-chip,.fpl-squad-panel .section-heading > span,.fpl-league-panel .section-heading > span,.fpl-player-mark b,.fpl-player strong,.fpl-player small,.fpl-player em,.fpl-player-badge,.fpl-leagues > span { font-size:12px; }
  .fpl-player { min-height:112px; background:#164B32; box-shadow:none; }
  .fpl-player strong { min-height:30px; display:grid; place-items:center; overflow:visible; white-space:normal; text-overflow:clip; overflow-wrap:anywhere; }
  .fpl-player small { color:#FFFFFF; }
  .fpl-player-mark { background:#FFFFFF; color:#22332B; }
  .fpl-player-mark b { color:#22332B; }
  .fpl-pitch { min-height:490px; background:repeating-linear-gradient(0deg,#426D4E 0,#426D4E 64px,#396144 64px,#396144 128px); box-shadow:none; }
  .fpl-player.is-bench { background:#164B32; }
  .cleaning-consumables strong,.cleaning-consumables small { font-size:12px; }
  .football-main,.favourite-standings,.family-person,.energy-meter { box-shadow:none; }
  .family-dashboard-heading h2,.family-person-heading h2 { letter-spacing:-.035em; }
  .choreops-link { background:var(--daily-accent-soft); color:var(--daily-accent); }
  .family-person-heading > span { background:color-mix(in srgb,var(--person-colour) 25%,#263A2E); color:#FFFFFF; border:0; }
  .family-kid-tab.is-selected { background:var(--daily-accent-soft); color:var(--daily-text); }
  .family-facts span,.family-summary-item { border:0; }
  .family-summary-item > span { background:var(--daily-warning-soft); color:var(--daily-warning); }
  .family-kid-tab > span,.calendar-person-filter > span,.day-people i,.fpl-entry-selector button > span,.fpl-team-card header > span { background:color-mix(in srgb,var(--person-colour) 25%,#263A2E); color:#FFFFFF; }
  .chore-row.is-kid-card > b { background:color-mix(in srgb,var(--person-colour) 10%,var(--daily-soft)); color:var(--daily-text); }
  .kid-mission i b { background:#FFFFFF; }
  .chore-claim-action { background:var(--daily-accent); color:var(--daily-on-accent); }
  .chore-claim-action:disabled { background:var(--daily-soft); color:var(--daily-muted); }
  .media-player-panel { background:var(--daily-surface); border:1px solid var(--daily-line); }
  .music-heading h2,.music-heading .eyebrow,.music-meta { color:var(--daily-text); }
  .media-player-stage { border-color:var(--daily-line); background:var(--daily-surface); }
  .music-experience,.media-player-panel { --ha-card-background:var(--daily-surface); --card-background-color:var(--daily-surface); --primary-text-color:var(--daily-text); --secondary-text-color:var(--daily-muted); }
  .calendar-card-slot { --ha-card-background:var(--daily-surface); --card-background-color:var(--daily-surface); --primary-text-color:var(--daily-text); --secondary-text-color:var(--daily-muted); }
  .family-planner-slot { background:var(--daily-soft); border-color:var(--daily-line); }
  .calendar-context strong,.calendar-range,.calendar-toolbar,.calendar-person-filter,.family-planner-day > header strong { color:var(--daily-text); }
  .calendar-person-filter,.calendar-nav button { background:var(--daily-surface); border-color:var(--daily-line); color:var(--daily-text); }
  .calendar-navigation button { background:var(--daily-surface); border-color:var(--daily-line); color:var(--daily-text); }
  .calendar-navigation strong,.calendar-context small { color:var(--daily-muted); }
  .calendar-context > ha-icon { color:var(--daily-accent); }
  .calendar-person-filter.is-selected { background:var(--daily-accent-soft); border-color:var(--daily-accent-line); color:var(--daily-text); box-shadow:none; }
  .family-planner-day,.planner-month-day,.planner-agenda-day { background:var(--daily-surface); border-color:var(--daily-line); }
  .family-planner-day.is-today,.planner-month-day.is-today,.planner-agenda-day.is-today { background:var(--daily-accent-soft); border-color:var(--daily-accent-line); box-shadow:none; }
  .family-planner-day > header { border-color:var(--daily-line); }
  .family-planner-day > header span,.family-planner-day > header small,.planner-month-headings,.planner-month-day > header,.planner-month-more,.planner-agenda-day > header,.family-planner-empty { color:var(--daily-muted); font-size:12px; }
  .family-planner-event { background:color-mix(in srgb,var(--calendar-colour) 8%,var(--daily-surface)); color:var(--daily-text); }
  .family-planner-event strong { color:var(--daily-text); }
  .family-planner-event small,.planner-event-time { color:var(--daily-muted); }
  .family-planner-event.is-compact strong { font-size:12px; }
  .planner-ready-state,.day-ready { background:var(--daily-warning-soft); color:var(--daily-warning); }
  .family-planner-event.is-ready .planner-ready-state,.day-ready.is-ready { background:var(--daily-success-soft); color:var(--daily-success); }
  .planner-modal,.planner-modal > footer,.planner-modal-close,.planner-check-item,.planner-editor-row input,.planner-editor-row select,.planner-event-form input,.planner-event-form select,.planner-event-form textarea,.planner-add-modal > footer button { background:var(--daily-surface); border-color:var(--daily-line); color:var(--daily-text); }
  .planner-modal > header { background:color-mix(in srgb,var(--calendar-colour,var(--daily-accent)) 8%,var(--daily-surface)); border-color:var(--daily-line); }
  .planner-modal > header h2,.planner-event-location,.planner-checklist-heading h3 { color:var(--daily-text); }
  .planner-modal > header p:last-child,.planner-event-description,.planner-no-prep,.planner-modal > footer > span,.planner-event-form label > span,.planner-event-form label > small { color:var(--daily-muted); }
  .planner-no-prep,.planner-check-item > button:first-child > span { background:var(--daily-soft); }
  .planner-checklist-editor,.planner-remove-item { border-color:var(--daily-line); }
  .planner-suggestion { background:var(--daily-warning-soft); border-color:var(--daily-warning-line); color:var(--daily-text); }
  .planner-suggestion p:not(.eyebrow) { color:var(--daily-muted); }
  .planner-editor-row button,.planner-add-modal > footer button.planner-save { background:var(--daily-accent); color:var(--daily-on-accent); border-color:var(--daily-accent); }
  .planner-check-item.is-complete { background:var(--daily-success-soft); border-color:var(--daily-success-line); }
  .planner-check-item.is-complete strong { color:var(--daily-muted); }
  .hub-brand:hover,.hub-nav-button:hover { background:var(--daily-accent-soft); }
  .hub-brand:focus-visible,.hub-nav-button:focus-visible { outline:3px solid var(--daily-accent); outline-offset:2px; }
  @media (min-width:761px) and (max-width:1279px) {
    .hub-content { grid-template-rows:56px auto; }
    .hub-view { min-height:calc(100vh - var(--family-ha-header-offset) - 120px); }
  }
  @media (min-width:761px) and (max-width:1120px) {
    .hub-shell { grid-template-columns:136px minmax(0,1fr); }
    .hub-navigation { padding:18px 8px; }
    .hub-content { padding-inline:18px; }
    .hub-wordmark { margin-inline:6px; }
    .hub-wordmark span { font-size:22px; }
    .hub-brand,.hub-nav-button { padding-inline:10px; gap:8px; }
    .hub-nav-button span,.hub-brand span { font-size:13px; }
    .today-hero h2 { font-size:40px; }
    .today-hero { grid-template-columns:100px minmax(0,1fr); }
    .hero-metrics button { padding:8px; gap:6px; }
    .today-next h2 { font-size:25px; }
    .home-toolbar { align-items:flex-start; flex-direction:column; }
    .home-segments { width:100%; }
    .security-layout { grid-template-columns:minmax(0,1fr) 260px; }
  }
  @media (max-width:760px) {
    .hub-wordmark,.hub-nav-label { display:none; }
    .hub-navigation { padding:7px; gap:6px; border:0; background:var(--daily-sidebar); box-shadow:none; }
    .hub-brand,.hub-nav-button { width:48px; height:48px; min-height:48px; flex:0 0 48px; margin:0; padding:10px; justify-content:center; }
    .hub-brand span,.hub-nav-button span { display:none; }
    .hub-nav-items { display:contents; }
    .hub-content { padding:12px; }
    .hub-page-title { flex:1 1 150px; }
    .hub-topbar h1 { font-size:27px; }
    .hub-header-actions { justify-content:flex-start; }
    .hub-weather-pill { font-size:12px; }
    .today-grid { display:flex; flex-direction:column; }
    .today-grid article { min-height:0; padding:18px; }
    .hero-panel.today-hero { display:grid; min-height:0; grid-template-columns:88px minmax(0,1fr); grid-template-rows:auto auto; padding:12px 0 8px; gap:18px 10px; }
    .today-hero h2 { font-size:36px; }
    .hero-metrics,.hero-metrics.has-energy { grid-template-columns:minmax(0,1fr); }
    .hero-metrics button { min-height:54px; }
    .today-next { min-height:210px !important; }
    .today-music { display:block; }
    .today-music .now-playing,.today-music .quiet-music { margin-top:14px; }
    .home-toolbar { flex-direction:column; }
  }
`;
