// Shared presentation only. Service boundaries, child cards and controls stay in
// family-hub-card. The dashboard defaults to light; an explicit appearance preference can opt in to dark or automatic mode.
export const DAILY_BRIEF_STYLES = `
  .hub-card {
    --daily-background:#F5F4F1; --daily-surface:#FFFFFF; --daily-sidebar:#F1F0ED;
    --daily-text:#242628; --daily-muted:#66686B; --daily-line:#E2E1DE;
    --daily-soft:#F0EFEC; --daily-accent:#1558AD; --daily-accent-soft:#E8EEF7;
    --daily-accent-line:#B8CAE3; --daily-on-accent:#FFFFFF;
    --daily-strong:#2F343A; --daily-strong-end:#20252B; --daily-on-strong:#FFFFFF;
    --daily-strong-muted:#D9E0E7; --daily-strong-accent:#D0DDEB;
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
    --daily-background:#17191C; --daily-surface:#24272C; --daily-sidebar:#1D2024;
    --daily-text:#F3F4F6; --daily-muted:#BAC0C8; --daily-line:#3C424B;
    --daily-soft:#2B3037; --daily-accent:#A8CBFF; --daily-accent-soft:#2D3B51;
    --daily-accent-line:#647A99; --daily-on-accent:#182A43;
    --daily-strong:#323A46; --daily-strong-end:#242C37;
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
  .hub-wordmark span { font-size:24px; line-height:.96; letter-spacing:-.06em; font-weight:500; }
  .hub-brand,.hub-nav-button { width:100%; min-height:48px; height:auto; margin:0; padding:10px 12px; display:flex; flex-direction:row; align-items:center; justify-content:flex-start; gap:10px; border:0; border-radius:12px; background:transparent; color:var(--daily-text); box-shadow:none; text-align:left; }
  .hub-brand ha-icon,.hub-nav-button ha-icon { flex:0 0 21px; --mdc-icon-size:21px; }
  .hub-brand span,.hub-nav-button span { font-size:14px; line-height:1.2; font-weight:500; }
  .hub-brand.is-active,.hub-nav-button.is-active { background:var(--daily-accent-soft); color:var(--daily-text); box-shadow:none; }
  .hub-brand.is-active span,.hub-nav-button.is-active span { font-weight:500; }
  .hub-nav-items,.hub-nav-core,.hub-nav-utility { flex:0 0 auto; margin:0; justify-content:flex-start; gap:3px; }
  .hub-nav-label { padding:9px 12px 4px; color:var(--daily-muted); font-size:12px; font-weight:500; letter-spacing:.06em; text-transform:uppercase; white-space:nowrap; }
  .hub-content { padding:16px 24px 24px; grid-template-rows:56px minmax(0,1fr); gap:14px; }
  .hub-page-title { align-items:flex-start; flex-direction:column; gap:6px; }
  .hub-topbar h1 { font-size:28px; letter-spacing:-.045em; font-weight:500; }
  .hub-topbar-date { font-size:12px; font-weight:500; }
  .hub-topbar-time { min-width:60px; font-size:22px; font-weight:500; }
  .hub-weather-pill { min-height:48px; padding:0 12px; border:0; border-radius:14px; background:var(--daily-surface); color:var(--daily-text); box-shadow:none; font-size:13px; font-weight:500; }
  .hub-weather-pill ha-icon { color:var(--daily-warning); }
  .surface { border:1px solid var(--daily-line); background:var(--daily-surface); color:var(--daily-text); border-radius:22px; box-shadow:var(--daily-shadow); }
  .surface h2,.surface h3,.surface strong { color:var(--daily-text); }
  .eyebrow,.surface .eyebrow { color:var(--daily-muted); font-weight:500; letter-spacing:.11em; }
  .section-heading h2 { font-size:22px; letter-spacing:-.035em; font-weight:500; }
  .section-heading > button,.text-action { color:var(--daily-accent); font-weight:500; }
  .icon-action,.scene-button,.camera-select-action { background:var(--daily-accent-soft); color:var(--daily-accent); }
  .segment.is-selected,.calendar-add-event,.garage-action,.calendar-modal-save,.planner-save { background:var(--daily-accent); color:var(--daily-on-accent); box-shadow:none; }
  .segments,.home-segments { background:var(--daily-soft); }
  .segment { font-weight:500; }
  .today-grid,.today-grid:has(.today-football[data-fixture-count="3"]),.today-grid:has(.today-football[data-fixture-count="4"]) { height:auto; min-height:0; grid-template-columns:repeat(6,minmax(0,1fr)); grid-template-rows:auto auto auto; align-content:start; gap:18px; }
  .today-grid article { padding:18px; overflow:visible; }
  .hero-panel.today-hero { grid-column:1/5; grid-row:1; grid-template-columns:116px minmax(0,1fr); grid-template-rows:auto auto; gap:16px 14px; align-content:center; padding:10px 0 4px; border:0; background:transparent; color:var(--daily-text); box-shadow:none; }
  .today-hero::after { content:none; }
  .today-hero-copy { grid-column:1/-1; align-self:start; }
  .today-hero .eyebrow { color:var(--daily-muted); }
  .today-hero h2 { margin:10px 0 0; color:var(--daily-text); font-size:46px; line-height:1.04; font-weight:500; letter-spacing:-.055em; }
  .today-hero-copy > p:last-child { margin-top:12px; color:var(--daily-muted); font-size:15px; }
  .daily-home-art { grid-row:2; grid-column:1; align-self:stretch; min-height:100px; overflow:hidden; border-radius:16px; background:var(--daily-soft); }
  .daily-home-art img { display:block; width:100%; height:100%; object-fit:cover; }
  .hero-metrics,.hero-metrics.has-energy { grid-row:2; grid-column:2; margin:0; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
  .hero-metrics[data-metric-count="1"] { grid-template-columns:minmax(0,1fr); }
  .today-hero:not(:has(.daily-home-art)) .hero-metrics { grid-column:1/-1; }
  .hero-metrics button { min-height:54px; padding:8px 10px; gap:8px; border:0; border-radius:12px; background:var(--daily-soft); color:var(--daily-text); }
  .hero-metrics button > ha-icon { --mdc-icon-size:20px; color:var(--daily-accent); }
  .hero-metrics strong { color:var(--daily-text); font-size:14px; font-weight:500; }
  .hero-metrics small { color:var(--daily-muted); font-size:12px; line-height:1.3; }
  .today-next { grid-column:5/7; grid-row:1; min-height:236px; padding:20px !important; border:0; background:var(--daily-accent-soft); box-shadow:none; }
  .today-card-icon { margin-bottom:14px; background:var(--daily-surface); color:var(--daily-accent); }
  .today-next h2 { font-size:27px; letter-spacing:-.04em; font-weight:500; overflow-wrap:anywhere; }
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
  .person-initial { border:0; background:var(--daily-surface); color:var(--daily-text); box-shadow:inset 0 0 0 2px var(--person-colour); }
  .compact-fixture { border:0; border-left:3px solid var(--daily-line); min-height:74px; background:var(--daily-soft); border-radius:12px; box-shadow:none; }
  .compact-fixture:not(.is-empty) { padding:6px 10px; gap:2px 8px; }
  .compact-fixture.is-derby { background:var(--daily-soft); border-right:3px solid #670E36; border-left:3px solid #132257; }
  .compact-team { font-size:13px; }
  .team-mark,.team-mark img { background:#FFFFFF; color:#242628; }
  .team-mark { box-shadow:none; }
  .team-mark strong { color:#242628; }
  .matchweek-controls button { flex:0 0 48px; min-width:48px; }
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
  .lighting-master h2,.heating-master h2,.energy-hero h2,.football-favourites-stage h2 { color:var(--daily-on-strong); font-weight:500; letter-spacing:-.035em; }
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
  .fpl-player strong { min-height:48px; display:grid; place-items:center; overflow:visible; white-space:normal; text-overflow:clip; overflow-wrap:anywhere; }
  .fpl-player small { color:#FFFFFF; }
  .fpl-player-mark { background:#FFFFFF; color:#242628; }
  .fpl-player-mark b { color:#242628; }
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
  .kid-mission,.kid-mission.is-complete { background:var(--daily-strong); }
  .kid-mission strong,.kid-mission p,.kid-mission em { color:var(--daily-on-strong); }
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
    .hub-topbar h1 { font-size:29px; }
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
  /* Approved Home in focus composition. The card owns its usable viewport;
     longer collections have explicit, contained scrolling surfaces. */
  :host { display:block; min-height:0; margin:0; height:var(--family-viewport-height,calc(100dvh - var(--header-height,56px))); }
  .hub-card { display:grid; height:100%; min-height:0; overflow:hidden; grid-template-columns:minmax(0,1fr); grid-template-rows:minmax(0,1fr) auto; border:0; border-radius:0; box-shadow:none; }
  .hub-shell { height:100%; min-height:0; overflow:hidden; grid-template-columns:78px minmax(0,1fr); }
  .hub-navigation { padding:16px 7px; gap:5px; overflow:auto; border-right:1px solid var(--daily-line); background:var(--daily-sidebar); }
  .hub-nav-items { display:contents; }
  .hub-nav-label,.hub-wordmark { display:none; }
  .hub-brand,.hub-nav-button { flex:0 0 auto; width:100%; min-height:60px; padding:9px 2px; flex-direction:column; justify-content:center; gap:6px; text-align:center; border-radius:17px; }
  .hub-brand span,.hub-nav-button span { font-size:12px; font-weight:500; }
  .hub-brand.is-active,.hub-nav-button.is-active { color:var(--daily-accent); }
  .hub-brand ha-icon,.hub-nav-button ha-icon { --mdc-icon-size:23px; }
  .hub-content { display:grid; min-height:0; overflow:hidden; padding:18px 22px 16px; grid-template-rows:48px minmax(0,1fr); gap:16px; }
  .hub-view { height:100%; min-height:0; overflow:hidden; overscroll-behavior:contain; }
  .hub-page-title { flex-direction:row; align-items:baseline; gap:14px; }
  .hub-topbar h1 { font-size:29px; font-weight:500; }
  .hub-topbar-date { font-size:12px; }
  .hub-weather-pill { min-height:48px; border:1px solid var(--daily-line); font-size:12px; border-radius:15px; }
  .hub-topbar-time { font-size:23px; font-weight:500; }
  .surface { border:0; box-shadow:var(--daily-shadow); }
  .surface h2,.surface h3 { font-weight:500; }
  .section-heading { margin:0; align-items:center; }
  .section-heading h2 { font-size:20px; font-weight:500; }
  .eyebrow { font-size:12px; letter-spacing:.11em; }
  .focus-dock-shell { min-width:0; min-height:0; }
  .focus-dock-shell:empty { display:none; }
  .focus-music-dock.today-music { display:grid; min-height:64px; grid-template-columns:42px minmax(90px,1fr) auto auto 90px; align-items:center; gap:12px; margin:0; padding:8px 22px !important; border:0; border-top:1px solid var(--daily-line); border-radius:0; background:var(--daily-surface); }
  .focus-music-dock .artwork { width:42px; height:42px; border-radius:10px; }
  .focus-dock-track { min-width:0; padding:0; text-align:left; border:0; background:none; color:var(--daily-text); cursor:pointer; }
  .focus-dock-track strong,.focus-dock-track small { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .focus-dock-track strong { font-size:13px; font-weight:500; }
  .focus-dock-track small { font-size:12px; color:var(--daily-muted); margin-top:3px; }
  .focus-dock-playback { display:flex; align-items:center; gap:5px; }
  .focus-dock-action { width:48px; height:48px; display:grid; place-items:center; border:0; border-radius:50%; background:transparent; color:var(--daily-text); cursor:pointer; }
  .focus-dock-action.is-play { background:var(--daily-text); color:var(--daily-surface); }
  .focus-dock-action:disabled { opacity:.45; cursor:default; }
  .focus-dock-output { display:flex; gap:5px; align-items:center; color:var(--daily-muted); }
  .focus-dock-output select { max-width:130px; min-height:48px; border:0; background:var(--daily-surface); color:var(--daily-text); font-size:12px; }
  .focus-dock-volume { width:100%; accent-color:var(--daily-text); min-height:48px; }

  .today-grid.focus-today,.today-grid.focus-today:has(.today-football) { display:grid; height:100%; min-height:0; grid-template-columns:minmax(0,1.25fr) minmax(0,1fr); grid-template-rows:minmax(0,1fr) auto auto; align-content:stretch; align-items:stretch; gap:14px 20px; }
  .today-grid.focus-today article { min-height:0; min-width:0; }
  .hero-panel.today-hero.focus-home-card { position:relative; display:block; grid-column:1; grid-row:1; min-height:0; padding:0; overflow:hidden; border-radius:24px; background:#736451; }
  .focus-home-card .daily-home-art { position:absolute; inset:0; min-height:0; border-radius:0; }
  .focus-home-card .daily-home-art::after { content:""; position:absolute; inset:0; background:linear-gradient(180deg,#0008,transparent 42%,#0006); }
  .focus-home-card .daily-home-art img { width:100%; height:100%; object-fit:cover; object-position:50% 62%; }
  .focus-home-card .today-hero-copy { position:absolute; top:24px; left:24px; right:65px; z-index:1; }
  .focus-home-card .today-hero-copy .eyebrow { color:#ffffffde; margin:0 0 8px; font-size:12px; }
  .focus-home-card .today-hero-copy h2 { color:#fff; margin:0; font-size:clamp(26px,3.1vw,36px); line-height:1.12; font-weight:500; }
  .focus-home-card .today-hero-copy > p:last-child { color:#fff; margin:8px 0; font-size:13px; }
  .focus-home-open { position:absolute; right:18px; top:18px; width:48px; height:48px; border:1px solid #ffffff55; border-radius:50%; background:#0004; color:#fff; }
  .focus-home-controls { display:grid; grid-template-columns:1fr 1fr; gap:10px; position:absolute; left:18px; right:18px; bottom:18px; z-index:1; }
  .focus-home-controls button { display:flex; min-width:0; min-height:64px; align-items:center; gap:10px; padding:12px; border:0; border-radius:16px; background:#fbfbf6f2; color:#242427; text-align:left; cursor:pointer; }
  .focus-home-controls button > ha-icon { --mdc-icon-size:24px; color:#9a6718; }
  .focus-home-controls strong,.focus-home-controls small { display:block; color:#242427; font-size:13px; }
  .focus-home-controls small { margin-top:4px; color:#555954; font-size:12px; }
  .focus-home-controls small ha-icon { --mdc-icon-size:13px; }
  .focus-home-controls button:disabled { opacity:.8; cursor:default; }
  .focus-today-plan { display:grid; min-height:0; grid-template-rows:auto minmax(0,1fr); gap:14px; grid-column:2; grid-row:1; }
  .focus-today .today-next { display:flex; flex-direction:column; grid-column:auto; grid-row:auto; min-height:0; margin:0; padding:0 !important; border:0; background:transparent; box-shadow:none; }
  .focus-today .today-next h2 { margin:6px 0; font-size:24px; line-height:1.2; font-weight:500; }
  .focus-today .today-next .supporting { margin:2px 0; font-size:12px; }
  .focus-today .today-next .text-action { min-height:48px; margin:4px 0 0; font-size:12px; align-self:flex-start; }
  .focus-today .today-next .focus-checklist { max-height:106px; overflow:auto; margin-top:8px; }
  .focus-today .today-family { display:grid; grid-template-rows:48px 64px minmax(0,1fr); min-height:0; gap:8px; padding:0; border:0; border-radius:0; background:transparent; box-shadow:none; overflow:hidden; }
  .focus-today .today-family .person-summary-list { grid-row:2; grid-template-columns:repeat(2,minmax(0,1fr)); min-height:0; }
  .focus-today .today-family .person-summary { padding:6px; gap:5px; grid-template-columns:28px minmax(0,1fr); }
  .focus-today .today-family .person-summary > span:first-child { width:28px; height:28px; }
  .focus-today .today-family .person-summary > .points { grid-column:2; white-space:nowrap; color:var(--daily-text); font-size:12px; }
  .focus-today .today-family .person-summary > div { min-width:0; }
  .focus-today .today-family .person-summary small { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .focus-today .today-family .today-ready-preview { grid-row:3; min-height:0; overflow:auto; scrollbar-width:thin; }
  .focus-today .today-family .section-heading h2 { font-size:18px; }
  .focus-today .today-family .section-heading button { min-height:48px; font-size:12px; }
  .person-summary-list { margin:0; gap:7px; }
  .person-summary { min-height:54px; padding:8px 12px; border:0; border-radius:16px; background:color-mix(in srgb,var(--person-colour) 8%,var(--daily-surface)); box-shadow:none; }
  .person-summary > span:first-child { width:33px; height:33px; border-radius:50%; font-size:13px; background:var(--daily-surface); color:var(--daily-text); box-shadow:inset 0 0 0 2px var(--person-colour); }
  .person-summary strong { font-size:13px; }
  .person-summary small { font-size:12px; }
  .person-summary > b { color:var(--daily-text); font-size:12px; }
  .today-ready-preview { margin:0; }
  .today-ready-heading { display:flex; justify-content:space-between; gap:8px; margin:0 0 5px; }
  .today-ready-heading strong,.today-ready-heading small { display:block; font-size:12px; }
  .today-ready-heading small { color:var(--daily-muted); }
  .today-ready-heading > b { font-size:12px; color:var(--daily-accent); }
  .today-ready-list { display:grid; gap:5px; }
  .today-ready-item { display:grid; grid-template-columns:24px minmax(0,1fr); gap:7px; align-items:center; width:100%; min-height:48px; padding:6px 8px; text-align:left; border:0; border-radius:10px; background:var(--daily-surface); color:var(--daily-text); cursor:pointer; }
  .today-ready-item ha-icon { color:var(--person-colour); --mdc-icon-size:20px; }
  .today-ready-item strong,.today-ready-item small { display:block; font-size:12px; }
  .today-ready-item small { margin-top:2px; color:var(--daily-muted); }
  .today-ready-item.is-complete strong { text-decoration:line-through; }
  .today-ready-more { min-height:48px; padding:0; border:0; background:transparent; color:var(--daily-accent); font-size:12px; text-align:left; }
  .focus-today .today-football { grid-template-columns:minmax(0,1fr); grid-column:1/-1; grid-row:2; display:grid; grid-template-rows:48px auto; padding:0; border:0; border-top:1px solid var(--daily-line); border-radius:0; background:transparent; box-shadow:none; gap:5px; }
  .focus-today .today-football .featured-fixtures { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:6px 10px; margin:0; }
  .focus-today .compact-fixture:not(.is-empty) { min-height:62px; padding:6px 10px; gap:2px 8px; grid-template-columns:minmax(0,1fr) 85px; border-radius:14px; background:var(--daily-surface); }
  .focus-today .compact-team { gap:6px; min-height:22px; }
  .focus-today .compact-team-name { font-size:12px; line-height:1.15; }
  .focus-today .team-crest { width:24px; height:24px; min-width:24px; }
  .focus-today .compact-score { font-size:14px; }
  .focus-today .compact-fixture-detail { font-size:12px; line-height:1.2; }
  .hero-metrics.focus-home-summary,.hero-metrics.focus-home-summary.has-energy { grid-row:3; grid-column:1/-1; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; margin:0; }
  .focus-home-summary button { min-height:52px; padding:7px 10px; border:0; border-radius:14px; background:var(--daily-surface); color:var(--daily-text); }
  .focus-home-summary strong { color:var(--daily-text); font-size:13px; }
  .focus-home-summary small { color:var(--daily-muted); font-size:12px; }
  .focus-home-summary ha-icon { --mdc-icon-size:20px; color:var(--daily-accent); }
  .focus-today[data-calendar="false"] .focus-home-card { grid-column:1; }
  .focus-hello { min-width:0; grid-column:1; padding:16px; }

  .home-surface { display:grid; height:100%; min-height:0; grid-template-rows:54px minmax(0,1fr); gap:12px; overflow:hidden; }
  .home-toolbar { min-height:0; flex-direction:row; align-items:center; gap:12px; }
  .home-toolbar > div:first-child { display:none; }
  .home-segments { width:100%; min-height:48px; gap:4px; padding:3px; border-radius:15px; }
  .home-segments .segment { flex:1; padding:0 10px; min-height:48px; font-size:12px; }
  .home-section { min-height:0; overflow:hidden; }
  .heating-experience { display:grid; height:100%; min-height:0; grid-template-columns:minmax(220px,.8fr) minmax(0,2fr); grid-template-rows:minmax(0,1fr); gap:14px; overflow:hidden; }
  .heating-master { display:flex; flex-direction:column; justify-content:space-between; gap:12px; min-height:0; padding:20px; overflow:auto; border-radius:22px; background:var(--daily-surface); color:var(--daily-text); }
  .heating-master .eyebrow,.heating-master-target { color:var(--daily-muted); }
  .heating-master h2 { color:var(--daily-text); font-size:24px; font-weight:500; }
  .heating-master-copy > span { display:block; margin-top:6px; color:var(--daily-muted); font-size:12px; }
  .heating-master-target { display:grid; justify-items:center; align-self:center; font-size:12px; }
  .master-dial { position:relative; display:grid; place-items:center; width:210px; height:185px; }
  .master-dial svg { position:absolute; width:180px; height:180px; transform:rotate(135deg); pointer-events:none; }
  .thermostat-track,.thermostat-value { fill:none; stroke-width:7; stroke-linecap:round; }
  .thermostat-track { stroke:var(--daily-soft); }
  .thermostat-value { stroke:#DCA344; }
  .master-temperature-stepper { position:relative; display:grid; grid-template-columns:48px 94px 48px; gap:6px; background:transparent; border:0; overflow:visible; }
  .master-temperature-stepper label { border:0; display:flex; justify-content:center; align-items:center; gap:1px; }
  .master-temperature-stepper label b { font-size:29px; color:var(--daily-text); }
  .master-temperature-stepper input { width:58px; height:48px; color:var(--daily-text); font-size:32px; font-weight:500; }
  .master-temperature-stepper button { width:48px; height:48px; border:0; border-radius:50%; background:var(--daily-soft); color:var(--daily-text); font-size:24px; }
  .heating-master-actions { display:grid; grid-template-columns:1fr 1fr; gap:8px; width:100%; }
  .heating-master-actions button { min-width:0; min-height:48px; padding:6px; background:var(--daily-soft); color:var(--daily-text); border:0; border-radius:13px; font-size:12px; }
  .heating-master-actions button:first-child { grid-column:1/-1; background:var(--daily-accent); color:var(--daily-on-accent); }
  .heating-master .master-schedule { width:100%; margin:0; flex:0 0 auto; background:transparent; }
  .heating-grid { display:grid; min-height:0; height:100%; grid-template-columns:repeat(3,minmax(0,1fr)); grid-template-rows:repeat(2,minmax(252px,1fr)); gap:10px; align-content:start; overflow:auto; scrollbar-width:thin; }
  .heating-grid[data-zone-count="1"],.heating-grid[data-zone-count="2"],.heating-grid[data-zone-count="3"] { grid-template-rows:minmax(0,1fr); }
  .heating-grid[data-zone-count] .heating-card { height:100%; min-height:0; padding:5px; gap:2px; }
  .heating-card { height:100%; display:flex; min-height:0; flex-direction:column; padding:12px; gap:6px; border:0; border-radius:20px; overflow:auto; background:var(--daily-surface); }
  .heating-card-heading { display:grid; grid-template-columns:minmax(0,1fr) 48px; gap:3px; min-height:48px; }
  .heating-card-heading .heating-icon { display:none; }
  .heating-card h3 { font-size:14px; line-height:1.2; font-weight:500; }
  .heating-status { margin-top:3px; font-size:12px; }
  .heating-power { width:48px; min-width:48px; height:48px; padding:0; border:0; border-radius:50%; background:var(--daily-soft); color:var(--daily-muted); }
  .heating-power ha-icon { --mdc-icon-size:20px; }
  .heating-power span { display:none; }
  .heating-body { flex:1; display:flex; flex-direction:column; justify-content:center; min-height:0; gap:4px; padding:0; border:0; }
  .thermostat-dial { position:relative; flex:0 0 88px; min-height:88px; width:108px; height:88px; display:grid; place-items:center; margin:auto; }
  .thermostat-dial svg { position:absolute; inset:0; width:100%; height:100%; transform:rotate(135deg); }
  .thermostat-dial > div { position:relative; display:grid; justify-items:center; gap:2px; }
  .thermostat-dial small { font-size:12px; color:var(--daily-muted); }
  .thermostat-dial .heating-target-value { min-height:0; border:0; font-size:27px; line-height:1; font-weight:500; color:var(--daily-text); }
  .thermostat-dial span { white-space:nowrap; font-size:12px; color:var(--daily-muted); }
  .thermostat-dial .heating-current-value { display:inline; font-size:12px; color:var(--daily-muted); font-weight:500; }
  .heating-target-control { display:block; }
  .heating-stepper { display:grid; width:100%; grid-template-columns:48px minmax(0,1fr) 48px; align-items:center; gap:2px; border:0; background:transparent; overflow:visible; }
  .heating-stepper button { width:48px; min-height:48px; border:0; border-radius:50%; background:var(--daily-soft); color:var(--daily-text); font-size:22px; }
  .heating-stepper > span { text-align:center; font-size:12px; color:var(--daily-muted); }
  .heating-schedule { margin:0; border:0; border-radius:12px; background:var(--daily-soft); flex:0 0 auto; }
  .heating-schedule summary { min-height:48px; padding:7px 9px; gap:4px; }
  .heating-schedule summary strong { font-size:12px; }
  .heating-schedule summary small { display:none; }
  .heating-schedule summary ha-icon { --mdc-icon-size:17px; }
  .heating-card.is-schedule-open { grid-column:auto; }
  .heating-master.is-schedule-open { justify-content:flex-start; }
  .schedule-periods,.master-schedule .schedule-periods { grid-template-columns:1fr; }
  .schedule-period { padding:8px; }
  .schedule-period input { min-height:48px; }

  .family-dashboard { display:grid; height:100%; min-height:0; grid-template-rows:48px minmax(0,1fr); gap:10px; overflow:hidden; }
  .family-dashboard.has-kid-switcher { grid-template-rows:48px 48px minmax(0,1fr); }
  .family-dashboard.has-claim-feedback { grid-template-rows:48px auto minmax(0,1fr); }
  .family-dashboard.has-kid-switcher.has-claim-feedback { grid-template-rows:48px 48px auto minmax(0,1fr); }
  .family-dashboard-heading { align-items:center; }
  .family-dashboard-heading .eyebrow { display:none; }
  .family-dashboard-heading h2 { font-size:22px; font-weight:500; }
  .family-kid-switcher { min-height:0; padding:0; gap:8px; }
  .family-kid-tab { min-width:125px; min-height:48px; padding:5px 12px; border:0; border-radius:14px; box-shadow:none; }
  .family-kid-tab.is-selected { background:var(--daily-surface); box-shadow:inset 0 0 0 1px var(--person-colour); }
  .family-kid-tab > span { width:30px; height:30px; font-size:12px; background:var(--daily-soft); color:var(--daily-text); box-shadow:inset 0 0 0 2px var(--person-colour); }
  .family-kid-stage { min-height:0; overflow:hidden; }
  .family-kid-stage .family-person.is-kid-mode { display:grid; height:100%; min-height:0; padding:16px; grid-template-columns:minmax(0,1fr) auto; grid-template-rows:78px minmax(0,1fr); gap:14px 16px; overflow:hidden; border:0; background:transparent; box-shadow:none; }
  .family-kid-stage .family-person-heading { display:none; }
  .kid-mission,.kid-mission.is-complete { grid-column:1; grid-row:1; display:flex; min-height:0; padding:0; gap:14px; background:transparent; border:0; color:var(--daily-text); }
  .progress-ring { --ring-colour:var(--daily-accent); width:76px; height:76px; flex:0 0 76px; display:grid; place-items:center; border-radius:50%; background:conic-gradient(var(--ring-colour) calc(var(--progress)*1%),var(--daily-line) 0); }
  .progress-ring > span { display:grid; place-items:center; width:62px; height:62px; border-radius:50%; background:var(--daily-background); color:var(--daily-text); font-size:22px; font-weight:500; }
  .kid-mission p { color:var(--daily-muted); font-size:12px; font-weight:500; letter-spacing:.08em; }
  .kid-mission strong { color:var(--daily-text); font-size:19px; font-weight:500; margin-top:5px; }
  .kid-mission .mission-symbol { margin-left:auto; --mdc-icon-size:28px; color:var(--daily-warning); }
  .family-facts { grid-column:2; grid-row:1; display:flex; gap:16px; margin:0; align-items:center; }
  .family-facts > span { min-width:70px; min-height:0; padding:0; background:none; color:var(--daily-muted); font-size:12px; }
  .family-facts strong { color:var(--daily-text); font-size:24px; font-weight:500; margin-bottom:3px; }
  .focus-task-workspace { grid-column:1/-1; grid-row:2; display:grid; min-height:0; grid-template-columns:minmax(0,1.4fr) minmax(0,1fr); gap:24px; margin:0; }
  .focus-task-jobs,.focus-task-rewards { min-width:0; min-height:0; overflow:auto; scrollbar-width:thin; padding:0 4px 0 0; }
  .focus-task-rewards { border-radius:20px; background:transparent; }
  .focus-task-jobs .chore-list { display:flex; flex-direction:column; margin:0; gap:8px; }
  .focus-task-jobs .chore-row.is-kid-card { display:grid; min-height:64px; grid-template-columns:36px minmax(0,1fr) auto 48px; align-items:center; gap:8px; padding:8px 10px; border:0; border-radius:16px; background:var(--daily-surface); }
  .chore-row.is-kid-card .chore-check { width:34px; height:34px; border-radius:10px; background:var(--daily-soft); color:var(--person-colour); }
  .chore-row.is-kid-card .chore-check ha-icon { --mdc-icon-size:22px; }
  .chore-row.is-kid-card > span:nth-child(2) strong { font-size:14px; font-weight:500; }
  .chore-row.is-kid-card > span:nth-child(2) small { font-size:12px; margin-top:3px; }
  .chore-row.is-kid-card > b { padding:4px 7px; font-size:12px; background:var(--daily-soft); border-radius:10px; color:var(--daily-muted); }
  .chore-row.is-kid-card .chore-claim-action { grid-column:4; grid-row:1; min-width:48px; width:48px; min-height:48px; padding:0; border-radius:50%; background:var(--daily-accent-soft); color:var(--daily-accent); font-size:12px; }
  .chore-row.is-kid-card .chore-claim-action::after { content:"✓"; font-size:23px; }
  .chore-row.is-kid-card.is-waiting .chore-claim-action::after { content:"…"; }
  .chore-row.is-kid-card.is-overdue { background:var(--daily-danger-soft); }
  .chore-row.is-kid-card.is-done { background:var(--daily-success-soft); }
  .chore-row.is-kid-card.is-done .chore-claim-action { background:var(--daily-success-soft); color:var(--daily-success); }
  .chore-claim-action:disabled { opacity:.55; }
  .family-preparation { margin-top:12px; padding:0; border:0; background:none; }
  .family-preparation .chore-heading { margin:0 0 8px; }
  .focus-task-event { padding:6px 0; border-bottom:1px solid var(--daily-line); }
  .focus-task-event > header { display:flex; gap:8px; align-items:center; margin-bottom:8px; }
  .focus-task-event > header > ha-icon { --mdc-icon-size:24px; color:var(--daily-warning); }
  .focus-task-event h3 { margin:0; font-size:14px; font-weight:500; }
  .focus-task-event small { color:var(--daily-muted); font-size:12px; }
  .focus-task-event header > button { margin-left:auto; border:0; width:48px; height:48px; border-radius:50%; background:var(--daily-soft); color:var(--daily-accent); }
  .focus-task-event .family-prep-list { gap:5px; }
  .focus-task-event .family-prep-item { min-height:48px; padding:7px; border:0; background:var(--daily-surface); border-radius:12px; }
  .family-prep-item strong { font-size:13px; font-weight:500; }
  .focus-task-rewards .family-summary-grid { display:flex; flex-direction:column; gap:10px; }
  .focus-task-rewards .family-summary-item { display:grid; grid-template-columns:56px minmax(0,1fr); align-items:center; min-height:114px; padding:14px; gap:12px; border:0; border-radius:20px; background:var(--daily-surface); }
  .focus-task-rewards .family-summary-item p { margin:0 0 4px; color:var(--daily-muted); font-size:12px; text-transform:uppercase; letter-spacing:.08em; }
  .focus-task-rewards .family-summary-item strong { font-size:15px; font-weight:500; }
  .focus-task-rewards .family-summary-item small { display:block; margin-top:4px; font-size:12px; }
  .focus-task-rewards .award-art { width:56px; height:56px; display:grid; place-items:center; border-radius:50%; background:conic-gradient(#DCA344 calc(var(--progress)*1%),var(--daily-warning-soft) 0); color:var(--daily-warning); }
  .award-art ha-icon { width:44px; height:44px; display:grid; place-items:center; border-radius:50%; background:var(--daily-surface); --mdc-icon-size:27px; }
  .focus-task-rewards .award-reward { min-height:158px; background:linear-gradient(135deg,var(--daily-warning-soft),var(--daily-surface)); }
  .focus-task-rewards .award-reward .award-art { width:64px; height:64px; background:var(--daily-warning-soft); border-radius:18px; }
  .award-reward .award-art ha-icon { background:transparent; --mdc-icon-size:36px; }
  .family-progress { height:5px; margin-top:10px; background:var(--daily-line); border-radius:6px; }
  .family-progress b { background:#DCA344; }
  .reward-claim { min-height:48px; margin-top:8px; background:var(--daily-accent); color:var(--daily-on-accent); font-size:12px; }


  /* Calendar keeps navigation in place and gives the selected day a full agenda. */
  .calendar-view { height:100%; min-height:0; padding:16px; grid-template-rows:48px 48px 48px minmax(0,1fr); gap:10px; overflow:hidden; background:var(--daily-surface); }
  .calendar-toolbar { min-width:0; gap:12px; }
  .calendar-context { min-width:0; }
  .focus-calendar-title { margin:0; font-size:24px; font-weight:500; }
  .calendar-context strong { display:none; }
  .calendar-toolbar-actions { min-width:0; gap:8px; }
  .calendar-modes { padding:0; background:var(--daily-soft); }
  .calendar-modes .segment { min-height:48px; padding:0 12px; font-size:12px; }
  .calendar-person-filter { min-height:48px; background:var(--daily-soft); border:0; box-shadow:none; font-weight:500; }
  .calendar-person-filter.is-selected { background:var(--daily-accent-soft); color:var(--daily-accent); box-shadow:none; }
  .calendar-navigation strong { font-size:13px; text-align:left; }
  .calendar-navigation button { border:0; background:var(--daily-soft); color:var(--daily-text); }
  .family-planner-slot { height:100%; min-height:0; display:grid; grid-template-rows:100px minmax(0,1fr); gap:16px; background:transparent; border:0; }
  .focus-week-picker { height:100px; min-height:0; gap:6px; }
  .family-planner-day { display:flex; height:100px; min-height:0; flex-direction:column; padding:8px; gap:3px; border:0; border-radius:14px; background:var(--daily-soft); color:var(--daily-text); text-align:left; cursor:pointer; }
  .family-planner-day.is-selected { background:var(--daily-accent-soft); box-shadow:inset 0 0 0 1px var(--daily-accent-line); }
  .family-planner-day.is-today { box-shadow:inset 0 0 0 1px var(--daily-accent-line); }
  .family-planner-day > header { position:static; display:grid; grid-template-columns:1fr auto; grid-template-rows:auto auto; padding:0; border:0; gap:4px; }
  .family-planner-day > header span { grid-column:1/-1; font-size:12px; font-weight:500; }
  .family-planner-day > header strong { font-size:24px; font-weight:500; }
  .family-planner-day > header small { align-self:center; font-size:12px; }
  .focus-calendar-dots { display:flex; min-height:5px; gap:3px; }
  .focus-calendar-dots i { width:5px; height:5px; border-radius:50%; background:var(--calendar-colour); }
  .focus-week-hint { display:block; width:100%; overflow:hidden; font-size:12px; white-space:nowrap; text-overflow:ellipsis; }
  .focus-week-hint small { display:none; }
  .focus-calendar-layout { display:grid; min-height:0; grid-template-columns:minmax(0,1.4fr) minmax(0,1fr); gap:20px; }
  .focus-calendar-agenda { min-height:0; overflow:auto; scrollbar-width:thin; }
  .focus-calendar-agenda > header { display:flex; justify-content:space-between; align-items:center; min-height:32px; margin-bottom:6px; }
  .focus-calendar-agenda h2 { margin:0; font-size:20px; }
  .focus-calendar-agenda header small { font-size:12px; color:var(--daily-muted); }
  .focus-agenda-row { display:grid; grid-template-columns:minmax(0,1fr) 100px; gap:10px; align-items:center; padding:6px 0; border-bottom:1px solid var(--daily-line); }
  .focus-agenda-row .family-planner-event { min-height:64px; background:transparent; border-radius:0; gap:4px; padding:5px 12px; }
  .focus-agenda-row .family-planner-event strong { font-size:15px; white-space:normal; overflow-wrap:anywhere; }
  .focus-plan-select { min-height:48px; border:0; border-radius:12px; background:var(--daily-soft); color:var(--daily-accent); display:flex; align-items:center; justify-content:center; gap:5px; font-size:12px; }
  .focus-plan-select[aria-pressed="true"] { background:var(--daily-accent-soft); }
  .focus-plan-select ha-icon { --mdc-icon-size:18px; }
  .focus-event-ready { min-height:0; padding:18px; border-radius:20px; background:var(--daily-warning-soft); color:var(--daily-text); overflow:auto; scrollbar-width:thin; }
  .focus-prep-icon { --mdc-icon-size:30px; color:var(--daily-warning); }
  .focus-event-ready .eyebrow { margin:8px 0; }
  .focus-event-ready h2 { margin:8px 0; font-size:23px; font-weight:500; }
  .focus-event-ready .supporting,.planner-no-prep { font-size:12px; line-height:1.4; color:var(--daily-muted); }
  .focus-checklist { display:grid; gap:6px; margin-top:14px; }
  .focus-ready-item { display:flex; min-height:48px; gap:8px; align-items:center; padding:8px; border:0; border-radius:10px; background:var(--daily-surface); color:var(--daily-text); text-align:left; cursor:pointer; font-size:13px; }
  .focus-ready-item ha-icon { flex:0 0 auto; color:var(--daily-warning); --mdc-icon-size:22px; }
  .focus-ready-item.is-complete span { text-decoration:line-through; }
  .focus-ready-person { margin-left:auto; font-size:12px; color:var(--daily-muted); }
  .focus-ready-count { font-size:12px; color:var(--daily-muted); }
  .focus-prep-links { display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px; margin-top:14px; }
  .focus-prep-links button,.focus-add-template { display:flex; min-height:48px; align-items:center; gap:5px; border:0; padding:0 8px; border-radius:12px; background:var(--daily-surface); color:var(--daily-accent); font-size:12px; }
  .calendar-view[data-planner-mode="month"] .family-planner-slot,.calendar-view[data-planner-mode="agenda"] .family-planner-slot { display:block; overflow:auto; }
  .planner-month-grid { height:100%; min-height:0; }
  .family-planner-slot > .calendar-loading,.family-planner-slot > .calendar-warning { position:absolute; top:0; left:0; right:0; z-index:2; margin:0; border-radius:10px; background:var(--daily-warning-soft); color:var(--daily-warning); }

  .home-overview { display:grid; height:100%; min-height:0; grid-template-rows:58px minmax(0,1fr); gap:12px; }
  .home-summary-links button { min-height:58px; padding:8px 12px; border:0; background:var(--daily-surface); }
  .home-summary-links strong { font-size:14px; }
  .home-summary-links small { font-size:12px; }
  .rooms-layout { display:grid; height:100%; min-height:0; grid-template-columns:minmax(0,1.5fr) minmax(280px,1fr); gap:14px; }
  .floorplan-panel { padding:16px; grid-template-rows:48px minmax(0,1fr); gap:12px; }
  .floorplan-heading .eyebrow { display:none; }
  .floorplan-heading h2 { font-size:20px; }
  .floorplan-heading .segment { min-height:48px; padding:0 10px; font-size:12px; }
  .floorplan-canvas { height:100%; min-height:0; }
  .room-detail.home-drawer { min-height:0; height:100%; padding:16px; overflow:auto; }
  .room-title h2 { font-size:24px; }
  .lights-experience { height:100%; min-height:0; display:grid; grid-template-rows:90px minmax(0,1fr); gap:12px; overflow:hidden; }
  .lighting-master { min-height:0; padding:14px 18px; background:var(--daily-surface); color:var(--daily-text); }
  .lighting-master h2 { color:var(--daily-text); font-size:22px; }
  .lighting-master .eyebrow,.lighting-master-copy > span { color:var(--daily-muted); font-size:12px; }
  .lighting-master-stats > span { border:0; background:var(--daily-soft); }
  .lighting-master-stats strong { color:var(--daily-text); }
  .lighting-master-stats small { color:var(--daily-muted); }
  .lighting-all-off { min-height:48px; background:var(--daily-accent-soft); color:var(--daily-accent); }
  .whole-home-grid { height:100%; min-height:0; grid-template-columns:repeat(3,minmax(0,1fr)); overflow:auto; }
  .whole-home-card { min-height:0; padding:14px; }
  .whole-home-heading h3 { font-size:16px; }
  .whole-home-heading button { min-height:48px; }
  .light-device { padding:8px; }
  .cover-grid { height:100%; min-height:0; overflow:auto; grid-template-columns:repeat(3,minmax(0,1fr)); }
  .cleaning-experience { display:grid; height:100%; min-height:0; grid-template-columns:minmax(0,1fr) minmax(0,1fr); }
  .cleaning-selectors select,.cleaning-command-grid button { min-height:48px; }

  .security-layout { display:grid; height:100%; min-height:0; grid-template-columns:minmax(0,1fr) 280px; gap:14px; }
  .security-main { min-height:0; display:grid; grid-template-rows:minmax(0,1fr) 174px; gap:12px; }
  .security-stage { min-height:0; padding:16px; grid-template-rows:48px minmax(0,1fr); background:var(--daily-surface); color:var(--daily-text); box-shadow:none; }
  .security-stage h2 { color:var(--daily-text); font-size:23px; }
  .security-stage-heading .eyebrow { color:var(--daily-muted); }
  .stage-privacy { background:var(--daily-soft); color:var(--daily-muted); border:0; }
  .stage-privacy ha-icon { color:var(--daily-accent); }
  .security-stage-media { width:100%; height:100%; min-height:0; max-width:100%; max-height:100%; aspect-ratio:auto; }
  .security-camera-picker { min-height:0; grid-template-columns:repeat(2,minmax(0,1fr)); }
  .security-camera { min-height:0; height:174px; grid-template-columns:90px minmax(0,1fr); grid-template-rows:minmax(0,1fr); }
  .camera-tile-media { min-height:0; }
  .camera-tile-media .camera-poster-action > span { max-width:100%; min-width:0; padding:4px; flex-direction:column; gap:3px; overflow-wrap:anywhere; text-align:center; }
  .camera-tile-details { padding:10px; gap:5px; }
  .security-camera .security-card-heading { gap:4px; }
  .security-card-heading h2 { font-size:16px; }
  .security-camera .eyebrow { font-size:12px; }
  .security-signals { gap:4px; }
  .security-camera .security-signals { display:flex; flex-wrap:wrap; gap:4px; }
  .security-camera .security-signal { flex:1 1 60px; min-width:60px; display:block; min-height:48px; padding:4px 2px; }
  .security-camera .security-signal ha-icon { display:none; }
  .security-camera .security-signal strong,.security-camera .security-signal small { display:block; font-size:12px; }
  .security-signals strong,.security-signals small { font-size:12px; }
  .football-health-note { max-width:100%; color:var(--daily-warning); border:0; background:var(--daily-warning-soft); }
  .camera-select-action { min-height:48px; padding:4px; font-size:12px; }
  .security-sidebar { grid-template-rows:minmax(0,1fr) auto auto; gap:10px; }
  .alarm-panel,.garage-panel { padding:16px; }
  .alarm-panel > p,.garage-motion,.security-privacy-note { font-size:12px; }
  .alarm-actions button,.garage-action { min-height:48px; font-size:12px; }
  .security-privacy-note { background:var(--daily-soft); border:0; }

  .energy-view { height:100%; min-height:0; grid-template-rows:90px 200px minmax(0,1fr) auto; gap:12px; overflow:hidden; }
  .energy-hero { padding:14px 18px; }
  .energy-hero h2 { font-size:30px; }
  .energy-hero p { margin:3px 0; font-size:12px; }
  .energy-meter { padding:16px; }
  .energy-primary-metrics { margin-top:12px; }
  .energy-primary-metrics strong { font-size:27px; }
  .energy-tariff { margin-top:12px; }
  .energy-history-grid { min-height:0; height:100%; }
  .energy-history-card { min-height:0; padding:12px; display:grid; grid-template-rows:48px minmax(0,1fr); overflow:auto; }
  .energy-history-slot { min-height:0; height:100%; }
  .energy-truth-note { padding:10px 14px; }
  .energy-truth-note strong,.energy-truth-note span { font-size:12px; }

  .football-experience { height:100%; min-height:0; grid-template-rows:230px minmax(0,1fr); gap:14px; overflow:hidden; }
  .football-favourites-stage { padding:14px 18px; background:var(--daily-surface); color:var(--daily-text); box-shadow:none; }
  .football-favourites-stage .eyebrow { color:var(--daily-muted); }
  .football-favourites-stage h2 { color:var(--daily-text); font-size:23px; }
  .football-freshness { background:var(--daily-soft); border:0; max-width:300px; }
  .football-freshness strong { color:var(--daily-text); }
  .football-freshness small { color:var(--daily-muted); }
  .favourite-hero-grid { margin-top:8px; gap:10px; }
  .favourite-hero-card { padding:10px 12px; border:0; border-radius:14px; }
  .favourite-club-identity strong,.derby-heading strong { font-size:15px; }
  .derby-heading { display:none; }
  .favourite-hero-card.is-derby { justify-content:center; }
  .football-layout { height:100%; min-height:0; display:grid; grid-template-columns:minmax(0,1fr) 240px; gap:14px; }
  .football-main { padding:14px; grid-template-rows:auto minmax(0,1fr); gap:12px; }
  .football-toolbar { display:flex; flex-wrap:wrap; min-width:0; gap:8px; }
  .football-toolbar > div:first-child { flex:1 1 120px; }
  .football-toolbar h2 { font-size:18px; }
  .football-toolbar .eyebrow { font-size:12px; }
  .football-tabs { margin-left:auto; }
  .football-tabs .segment { min-height:48px; padding:0 10px; font-size:12px; }
  .fixture-groups,.league-table-wrap { min-height:0; height:100%; overflow:auto; }
  .favourite-standings { padding:16px; }
  .favourite-standings h2 { font-size:19px; }
  .fpl-detail { display:grid; height:100%; min-height:0; grid-template-rows:48px auto minmax(0,1fr); overflow:hidden; }
  .fpl-detail-grid { min-height:0; grid-template-columns:minmax(0,1.6fr) minmax(210px,1fr); }
  .fpl-team-card { padding:10px 14px; border:0; }
  .fpl-scoreboard { margin-top:8px; }
  .fpl-scoreboard span { padding:7px; }
  .fpl-team-card header { display:none; }
  .fpl-squad-panel,.fpl-league-panel { padding:12px; overflow:auto; }
  .fpl-pitch { min-height:420px; padding:10px 6px; }
  .fpl-player { width:clamp(62px,7vw,94px); min-height:86px; grid-template-rows:32px auto auto; gap:2px; }
  .fpl-player-mark { width:30px; height:30px; }
  .fpl-player-mark img { width:24px; height:24px; inset:3px; }
  .fpl-player strong { min-height:20px; font-weight:500; }
  .fpl-leagues > span { min-height:48px; }

  .music-experience,.media-player-panel { height:100%; min-height:0; }
  .media-player-panel { padding:16px; grid-template-rows:48px minmax(0,1fr); gap:12px; overflow:hidden; border:0; }
  .music-heading h2 { font-size:23px; }
  .media-player-stage { height:100%; min-height:0; overflow:auto; background:var(--daily-surface); border:0; }
  .media-player-stage .child-card-slot { height:100%; min-height:0; --ha-card-background:var(--daily-surface); --card-background-color:var(--daily-surface); --primary-background-color:var(--daily-surface); --secondary-background-color:var(--daily-soft); --primary-text-color:var(--daily-text); --secondary-text-color:var(--daily-muted); --mmpc-card:var(--daily-surface); --mmpc-on-card:var(--daily-text); --mmpc-on-card-muted:var(--daily-muted); --mmpc-on-card-divider:var(--daily-line); --mmpc-chip-background:var(--daily-accent-soft); --mmpc-chip-foreground:var(--daily-accent); --mmpc-chip-border:var(--daily-line); }
  .media-player-stage .embedded-card,.media-player-stage .child-card-slot > * { height:100%; min-height:0; }


  .home-surface { position:relative; }
  .home-surface > .calendar-warning { position:absolute; inset:60px 0 auto; z-index:2; margin:0; padding:8px; background:var(--daily-warning-soft); }
  .football-experience.is-fpl { grid-template-rows:minmax(0,1fr); }
  .football-experience.is-fpl .football-favourites-stage { display:none; }
  .football-layout.is-fpl .football-main { height:100%; min-height:0; grid-template-rows:auto minmax(0,1fr); overflow:hidden; }
  .fpl-detail { min-height:0; }
  .fpl-detail-grid,.fpl-squad-panel,.fpl-league-panel { height:100%; min-height:0; }
  .fpl-team-card header { display:flex; }
  .fpl-team-card header > span,.fpl-team-card header .eyebrow { display:none; }
  .fpl-team-card header h3 { margin:0; font-size:17px; }
  .fpl-pitch { min-height:330px; }
  .calendar-modes .segment { padding-inline:15px; }
  .security-camera .camera-select-action { min-height:48px; }
  .thermostat-dial .heating-target-value { font-size:24px; }
  .heating-card .heating-stepper button { border-radius:50%; }
  @media (orientation:portrait), (max-width:850px) {
    .hub-shell { display:grid; grid-template-columns:1fr; grid-template-rows:64px minmax(0,1fr); }
    .hub-navigation { display:flex; flex-direction:row; padding:5px 12px; gap:5px; overflow:auto; border:0; border-bottom:1px solid var(--daily-line); }
    .hub-brand,.hub-nav-button { flex:1 0 64px; width:64px; min-height:54px; padding:5px 2px; border-radius:14px; gap:4px; }
    .hub-nav-items { display:contents; }
    .hub-content { padding:16px 18px; grid-template-rows:48px minmax(0,1fr); gap:14px; }
    .hub-page-title { display:flex; flex-direction:column; align-items:flex-start; gap:3px; }
    .hub-topbar h1 { font-size:29px; }
    .hub-header-actions { gap:12px; }
    .hub-weather-pill { padding:0 10px; }
    .today-grid.focus-today,.today-grid.focus-today:has(.today-football) { display:grid; height:100%; grid-template-columns:repeat(2,minmax(0,1fr)); grid-template-rows:minmax(200px,1fr) minmax(230px,.7fr) auto auto; gap:14px; }
    .hero-panel.today-hero.focus-home-card { grid-column:1/-1; grid-row:1; min-height:0; }
    .focus-home-card .today-hero-copy { top:20px; left:22px; }
    .focus-home-card .today-hero-copy h2 { font-size:32px; }
    .focus-today-plan { display:contents; }
    .focus-today .today-next { grid-column:1; grid-row:2; overflow:auto; }
    .focus-today .today-family { grid-column:2; grid-row:2; }
    .focus-today .today-next h2 { font-size:22px; }
    .focus-today .today-football { grid-row:3; }
    .focus-today .today-football .featured-fixtures { grid-template-columns:repeat(2,minmax(0,1fr)); }
    .hero-metrics.focus-home-summary { grid-row:4; grid-template-columns:repeat(2,minmax(0,1fr)); }
    .focus-music-dock.today-music { grid-template-columns:40px minmax(0,1fr) auto; min-height:64px; padding:8px 16px !important; }
    .focus-dock-output,.focus-dock-volume { display:none; }
    .heating-experience { grid-template-columns:1fr; grid-template-rows:180px minmax(0,1fr); }
    .heating-master { display:grid; grid-template-columns:minmax(0,1fr) 204px minmax(0,1fr); grid-template-rows:1fr auto; align-items:center; gap:6px 16px; padding:14px 18px; overflow:auto; }
    .heating-master-target { grid-column:2; grid-row:1/3; }
    .master-dial { width:198px; height:144px; }
    .master-dial svg { width:142px; height:142px; }
    .master-temperature-stepper { grid-template-columns:48px 82px 48px; gap:3px; }
    .heating-master h2 { font-size:21px; }
    .heating-master-actions { grid-column:3; grid-row:1/3; gap:6px; }
    .heating-master .master-schedule { grid-column:1; grid-row:2; }
    .heating-master .master-schedule summary small { display:none; }
    .heating-grid { grid-template-columns:repeat(3,minmax(0,1fr)); grid-template-rows:repeat(2,minmax(0,1fr)); }
    .heating-card { padding:12px; }
    .thermostat-dial { width:130px; height:130px; }
    .focus-task-workspace { grid-template-columns:minmax(0,1.3fr) minmax(0,1fr); gap:16px; }
    .family-kid-stage .family-person.is-kid-mode { padding:4px 0; }
    .kid-mission strong { font-size:18px; }
    .family-facts { gap:12px; }
    .family-facts > span { min-width:55px; }

    .calendar-view { padding:14px; }
    .family-planner-slot { grid-template-rows:100px minmax(0,1fr); }
    .focus-calendar-layout { grid-template-columns:minmax(0,1.1fr) minmax(0,1fr); gap:14px; }
    .focus-event-ready { padding:14px; }
    .rooms-layout { display:grid; height:100%; grid-template-columns:1fr; grid-template-rows:minmax(260px,1fr) minmax(240px,.85fr); }
    .home-overview { height:100%; }
    .floorplan-panel { min-height:0; }
    .home-summary-links { min-height:0; }
    .lights-experience { height:100%; }
    .whole-home-grid { height:100%; overflow:auto; grid-template-columns:repeat(2,minmax(0,1fr)); }
    .cover-grid { height:100%; grid-template-columns:repeat(2,minmax(0,1fr)); overflow:auto; }
    .cleaning-experience { height:100%; grid-template-columns:1fr; grid-template-rows:minmax(0,1fr) 240px; }
    .security-layout { display:grid; height:100%; grid-template-columns:1fr; grid-template-rows:minmax(0,1fr) 220px; gap:12px; }
    .security-main { display:grid; min-height:0; grid-template-rows:minmax(0,1fr) 174px; }
    .security-stage { display:grid; grid-template-rows:48px minmax(0,1fr); }
    .security-stage-media { min-height:0; height:100%; }
    .security-camera-picker { grid-template-columns:repeat(2,minmax(0,1fr)); }
    .security-sidebar { display:grid; grid-template-columns:1fr 1fr; grid-template-rows:minmax(0,1fr); }
    .security-privacy-note { grid-column:1/-1; }
    .alarm-panel > p { margin:6px 0; }
    .alarm-actions { margin-top:8px; }
    .energy-view { height:100%; grid-template-rows:100px 220px minmax(0,1fr) auto; }
    .football-experience { min-width:0; height:100%; grid-template-rows:230px minmax(0,1fr); }
    .football-layout { display:grid; height:100%; grid-template-columns:minmax(0,1fr) 200px; }
    .football-main { min-height:0; }
    .football-toolbar > div:first-child { flex-basis:100%; }
    .football-tabs { margin-left:0; }
    .football-layout.is-fpl { grid-template-columns:1fr; }
    .football-layout.is-fpl .football-main { grid-template-rows:auto minmax(0,1fr); }
    .fpl-detail-grid { grid-template-columns:minmax(0,1.8fr) minmax(210px,1fr); }
    .music-experience,.media-player-panel { height:100%; min-height:0; }
    .media-player-panel { grid-template-rows:48px minmax(0,1fr); }
    .media-player-stage,.media-player-stage .child-card-slot,.media-player-stage .embedded-card,.media-player-stage .child-card-slot > * { height:100%; min-height:0; }
  }
  @media (max-width:620px) {
    .hub-content { padding:12px; }
    .hub-topbar-time { display:none; }
    .hub-weather-pill span { max-width:110px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .hub-page-title .hub-topbar-date { font-size:12px; }
    .hub-nav-button span,.hub-brand span { font-size:12px; }
    .today-grid.focus-today,.today-grid.focus-today:has(.today-football) { display:flex; flex-direction:column; height:auto; min-height:100%; overflow:visible; }
    .today-grid.focus-today .focus-home-card { min-height:220px; height:220px; flex:none; }
    .today-grid.focus-today .today-next,.today-grid.focus-today .today-family,.today-grid.focus-today .today-football { min-height:max-content; flex:none; }
    .focus-today .today-next,.focus-today .today-family { grid-column:1; grid-row:auto; overflow:visible; }
    .focus-today .today-family { grid-template-rows:48px 64px auto; height:auto; }
    .focus-today .today-family .today-ready-preview { overflow:visible; }
    .focus-today .today-football { grid-row:auto; min-height:max-content; height:auto; grid-template-rows:48px max-content; overflow:visible; }
    .focus-today .today-football .featured-fixtures { min-height:max-content; height:max-content; flex-shrink:0; align-self:start; }
    .hero-metrics.focus-home-summary { grid-row:auto; }
    .focus-today .today-football .featured-fixtures { grid-template-columns:1fr; }
    .focus-home-controls { left:12px; right:12px; bottom:12px; gap:6px; }
    .focus-home-controls button { padding:8px; gap:6px; }
    .home-toolbar,.home-segments { min-width:0; max-width:100%; }
    .home-segments { overflow:auto; }
    .home-segments .segment { flex:0 0 auto; }
    .home-section { height:auto; overflow:visible; }
    .heating-experience { display:flex; height:auto; flex-direction:column; overflow:visible; }
    .heating-master { display:flex; min-height:400px; }
    .heating-grid { display:grid; height:auto; overflow:visible; grid-template-columns:repeat(2,minmax(0,1fr)); grid-auto-rows:280px; grid-template-rows:none; }
    .family-kid-stage { height:auto; overflow:visible; }
    .family-kid-stage .family-person.is-kid-mode { display:flex; height:auto; flex-direction:column; overflow:visible; }
    .family-facts { display:flex; }
    .focus-task-workspace { display:flex; flex-direction:column; overflow:visible; }
    .focus-task-jobs,.focus-task-rewards { overflow:visible; }
    .family-dashboard-heading h2 { font-size:19px; }
    .chore-row.is-kid-card > b { display:none; }
    .focus-task-jobs .chore-row.is-kid-card { grid-template-columns:32px minmax(0,1fr) 48px; }
    .chore-row.is-kid-card .chore-claim-action { grid-column:3; }
    .hub-view { overflow:auto; }
    .calendar-view,.home-surface,.home-overview,.family-dashboard,.music-experience,.media-player-panel,.energy-view,.football-experience { height:auto; min-height:100%; overflow:visible; }
    .energy-view { grid-template-rows:auto auto auto auto; }
    .energy-meter-grid,.energy-history-grid { height:auto; grid-template-columns:1fr; }
    .energy-hero,.energy-meter { height:auto; overflow:visible; }
    .energy-history-card { min-height:200px; }
    .calendar-view { grid-template-rows:auto auto auto minmax(320px,1fr); }
    .calendar-toolbar { flex-wrap:wrap; }
    .calendar-toolbar-actions { flex-wrap:wrap; }
    .family-planner-slot { min-height:440px; height:auto; min-width:0; overflow:hidden; }
    .family-planner-grid.focus-week-picker { min-width:0; grid-template-columns:repeat(7,minmax(0,1fr)); }
    .family-planner-day > header small { display:none; }
    .family-planner-day { padding:4px; }
    .calendar-navigation { gap:4px; }
    .calendar-navigation strong { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .focus-calendar-layout { grid-template-columns:1fr; }
    .focus-calendar-agenda { max-height:400px; }
    .rooms-layout { height:auto; grid-template-rows:320px auto; }
    .floorplan-heading { flex-direction:column; align-items:flex-start; gap:6px; }
    .room-detail.home-drawer { height:auto; }
    .lights-experience { height:auto; grid-template-rows:auto auto; }
    .lighting-master { flex-wrap:wrap; }
    .whole-home-grid { height:auto; grid-template-columns:1fr; overflow:visible; }
    .security-layout { display:flex; height:auto; }
    .security-main { display:flex; flex-direction:column; }
    .security-stage { min-height:320px; }
    .security-camera-picker { grid-template-columns:1fr; }
    .security-sidebar { display:flex; flex-direction:column; }
    .football-experience { min-width:0; grid-template-rows:250px minmax(0,1fr); }
    .football-layout { height:auto; grid-template-columns:1fr; }
    .football-layout.is-fpl .football-main { height:auto; overflow:visible; }
    .football-favourites-stage,.football-hero-heading,.football-hero-heading > div { min-width:0; width:100%; }
    .football-hero-heading { flex-wrap:wrap; }
    .football-freshness { max-width:100%; }
    .football-favourites-stage { box-sizing:border-box; }
    .fpl-detail { height:auto; overflow:visible; }
    .fpl-detail-grid { height:auto; grid-template-columns:1fr; }
    .media-player-panel { min-height:640px; grid-template-rows:48px 560px; }

  }

  /* Shared design fabric from the approved working compositions. */
  .hub-card { --daily-background:#F5F4F1; --daily-sidebar:#FFFFFF; --daily-soft:#F0F0F2; --daily-line:#E4E4E8; --daily-muted:#6C7079; --daily-accent:#1266CF; --daily-accent-soft:#E8F1FF; --hub-radius:24px; grid-template-rows:56px minmax(0,1fr) auto; font-weight:400; }
  .hub-card[data-appearance="dark"] { --daily-background:#17191C; --daily-sidebar:#22252A; --daily-soft:#2B3037; --daily-line:#3C424B; --daily-muted:#BAC0C8; --daily-accent:#A8CBFF; --daily-accent-soft:#2D3B51; }
  .hub-masthead { min-width:0; display:flex; align-items:center; justify-content:space-between; padding:0 24px; background:var(--daily-surface); border-bottom:1px solid var(--daily-line); gap:12px; }
  .hub-masthead-brand { display:flex; align-items:center; gap:9px; min-height:48px; border:0; padding:0; background:transparent; color:var(--daily-text); font-size:18px; letter-spacing:-.035em; font-weight:500; cursor:pointer; }
  .hub-outline-icon { display:block; width:22px; height:22px; flex:none; }
  .hub-masthead-status { display:flex; align-items:center; gap:16px; color:var(--daily-muted); font-size:12px; }
  .hub-quiet-status { display:flex; align-items:center; gap:6px; border:0; padding:0; min-height:48px; background:transparent; color:var(--daily-success); font-size:12px; }
  .hub-quiet-status .hub-outline-icon { width:18px; height:18px; }
  .hub-profile { width:32px; height:32px; border-radius:50%; display:grid; place-items:center; background:var(--daily-soft); color:var(--daily-text); font-size:12px; }
  .hub-ha-escape { color:var(--daily-muted); text-decoration:none; min-width:32px; min-height:48px; display:grid; place-items:center; }
  .hub-shell { grid-template-columns:80px minmax(0,1fr); }
  .hub-navigation { padding:17px 8px; gap:6px; background:var(--daily-sidebar); border:0; }
  .hub-brand,.hub-nav-button { min-height:60px; padding:8px 2px; border-radius:15px; color:var(--daily-muted); gap:7px; }
  .hub-brand.is-active,.hub-nav-button.is-active { background:var(--daily-accent-soft); color:var(--daily-accent); }
  .hub-brand span,.hub-nav-button span { font-size:11px; font-weight:400; }
  .hub-brand.is-active span,.hub-nav-button.is-active span { font-weight:500; }
  .hub-content { padding:26px 28px 18px; grid-template-rows:60px minmax(0,1fr); gap:20px; }
  .hub-content:has(.calendar-view) { grid-template-rows:0 minmax(0,1fr); gap:0; }
  .hub-topbar.is-calendar-header { visibility:hidden; height:0; min-height:0; overflow:hidden; }
  .hub-topbar { padding:0; align-items:center; }
  .hub-page-title { flex-direction:column; align-items:flex-start; gap:7px; }
  .hub-topbar h1 { font-size:30px; line-height:1.1; font-weight:500; letter-spacing:-.045em; }
  .hub-topbar-date { font-size:14px; font-weight:400; margin:0; color:var(--daily-muted); }
  .hub-weather-pill { min-height:48px; padding:0; border:0; border-radius:0; background:transparent; color:var(--daily-muted); font-size:14px; font-weight:400; gap:8px; }
  .hub-weather-pill ha-icon { color:var(--daily-muted); --mdc-icon-size:20px; }
  .surface { border:0; border-radius:24px; background:var(--daily-surface); box-shadow:none; backdrop-filter:none; -webkit-backdrop-filter:none; }
  .surface h2,.surface h3,.section-heading h2 { font-weight:500; letter-spacing:-.035em; }
  .eyebrow { font-size:12px; font-weight:500; }
  .supporting { line-height:1.5; font-weight:400; }
  .section-heading h2 { font-size:18px; }
  .text-action,.section-heading > button { font-size:14px; font-weight:400; }
  .segments { border:0; padding:4px; border-radius:12px; background:var(--daily-soft); gap:3px; }
  .segment { min-height:48px; border:0; border-radius:9px; background:transparent; color:var(--daily-muted); font-weight:400; font-size:14px; }
  .segment.is-selected { background:var(--daily-surface); color:var(--daily-text); box-shadow:0 2px 7px #00000008; font-weight:500; }
  .calendar-add-event,.garage-action,.calendar-modal-save,.planner-save { border:0; border-radius:12px; background:var(--daily-accent); color:var(--daily-on-accent); font-weight:400; }
  .icon-action,.scene-button,.camera-select-action { background:var(--daily-soft); color:var(--daily-text); font-weight:400; }
  .focus-dock-volume { accent-color:var(--daily-accent); }
  .focus-dock-track strong { font-weight:500; }

  .today-grid.focus-today,.today-grid.focus-today:has(.today-football) { grid-template-columns:minmax(0,1.17fr) minmax(0,1fr); grid-template-rows:minmax(280px,1fr) 155px 44px; gap:20px 24px; }
  .focus-home-card .today-hero-copy { top:22px; left:22px; }
  .focus-home-card .today-hero-copy h2 { margin:0 0 5px; font-size:27px; font-weight:500; }
  .focus-home-card .today-hero-copy > p { font-size:12px; margin:0; color:#fff; }
  .focus-home-card .daily-home-art::after { background:linear-gradient(180deg,#0004,transparent 38%,#0005); }
  .focus-home-open { background:#FFFFFFED; color:#242628; border:0; }
  .focus-home-controls { left:20px; right:20px; bottom:20px; gap:10px; }
  .focus-home-controls button { min-height:72px; border-radius:16px; padding:12px; background:#FFFFFFED; }
  .focus-home-controls strong { font-size:16px; font-weight:500; }
  .focus-home-controls small { font-size:12px; font-weight:400; }
  .focus-today-plan { grid-template-rows:auto minmax(0,1fr); gap:12px; }
  .focus-today .today-next { padding-bottom:8px !important; border-bottom:1px solid var(--daily-line); }
  .focus-today .today-next h2 { font-size:24px; font-weight:500; margin:6px 0 10px; }
  .focus-today .today-next .supporting { margin:2px 0; font-size:13px; }
  .focus-today .today-next .focus-checklist { display:flex; flex-wrap:wrap; gap:7px; max-height:98px; overflow:auto; }
  .focus-ready-item { border:0; font-weight:400; border-radius:10px; }
  .focus-today .focus-ready-item { width:auto; flex:0 1 auto; min-height:48px; padding:6px 8px; background:var(--daily-surface); font-size:12px; }
  .focus-today .focus-ready-person { display:none; }
  .focus-ready-count { font-size:12px; color:var(--daily-muted); margin:7px 0 0; }
  .focus-today .today-next .text-action { align-self:flex-end; margin:-27px 0 0; min-height:48px; }
  .focus-today .today-family { display:flex; flex-direction:column; gap:4px; grid-template-rows:none; overflow:auto; }
  .focus-today .today-family .section-heading { min-height:48px; }
  .focus-today .today-family .section-heading h2 { font-size:18px; }
  .focus-today .today-family .section-heading button { min-height:48px; font-size:14px; }
  .today-job-list { display:grid; gap:2px; }
  .today-job { display:grid; grid-template-columns:42px minmax(0,1fr) 44px; align-items:center; gap:12px; padding:6px 0; min-height:58px; }
  .today-person-token { width:42px; height:42px; display:grid; place-items:center; color:var(--person-colour); background:color-mix(in srgb,var(--person-colour) 10%,var(--daily-surface)); border-radius:14px; font-size:14px; }
  .today-job strong,.today-job small { display:block; font-size:14px; font-weight:400; }
  .today-job small { font-size:12px; color:var(--daily-muted); margin-top:4px; }
  .today-job-action { width:44px; height:44px; border:0; border-radius:50%; background:var(--daily-surface); color:var(--daily-text); cursor:pointer; }
  .focus-today .today-family .today-ready-preview { grid-row:auto; overflow:visible; flex:none; padding-top:7px; }
  .focus-today .today-football { grid-template-rows:32px minmax(0,1fr); gap:8px; border-top:0; }
  .focus-today .today-football .featured-fixtures { grid-template-columns:repeat(2,minmax(0,1fr)); gap:20px; }
  .club-overview { min-width:0; padding:20px; background:var(--daily-surface); border-radius:24px; }
  .club-overview > header { display:flex; align-items:center; gap:12px; margin-bottom:18px; }
  .club-overview h2 { margin:0; font-size:24px; font-weight:500; letter-spacing:-.035em; }
  .club-overview header small { display:block; margin-top:4px; color:var(--daily-muted); font-size:12px; }
  .club-match-row { display:flex; align-items:center; justify-content:space-between; gap:12px; width:100%; min-height:48px; padding:14px 0; background:transparent; border:0; color:var(--daily-text); text-align:left; cursor:pointer; }
  .club-match-row strong { display:block; font-size:14px; font-weight:400; line-height:1.35; }
  .club-match-row small { display:block; color:var(--daily-muted); font-size:12px; margin-top:3px; line-height:1.4; }
  .club-match-row b { flex:none; font-size:28px; font-weight:400; letter-spacing:-.03em; }
  .club-next-row { border-top:1px solid var(--daily-line); }
  .club-overview.is-compact { padding:0; border-radius:0; background:transparent; }
  .club-overview.is-compact > header { margin-bottom:5px; gap:10px; }
  .club-overview.is-compact h2 { font-size:16px; }
  .club-overview.is-compact .team-mark { width:30px; height:30px; min-width:30px; border-radius:9px; }
  .club-overview.is-compact .club-match-row { min-height:48px; padding:6px 0; }
  .club-overview.is-compact .club-match-row b { font-size:21px; }
  .club-overview.is-compact .club-next-row > small { text-align:right; flex:none; }
  .hero-metrics.focus-home-summary,.hero-metrics.focus-home-summary.has-energy { display:flex; align-items:center; flex-wrap:wrap; gap:8px 18px; grid-row:3; padding-top:0; border-top:1px solid var(--daily-line); }
  .focus-home-summary button { display:flex; align-items:center; gap:7px; min-height:48px; padding:0; background:transparent; border-radius:0; }
  .focus-home-summary button span { display:block; margin:0; }
  .focus-home-summary strong { font-size:12px; color:var(--daily-muted); font-weight:400; }
  .focus-home-summary small { display:none; }
  .focus-home-summary ha-icon { color:var(--daily-muted); --mdc-icon-size:18px; }

  .calendar-view { padding:0; background:transparent; border-radius:0; box-shadow:none; grid-template-rows:60px 48px 44px minmax(0,1fr); gap:16px; }
  .calendar-toolbar { align-items:center; min-height:0; }
  .calendar-context h2.focus-calendar-title { font-size:30px; font-weight:500; line-height:1.1; margin:0 0 7px; }
  .calendar-context strong { font-size:14px; font-weight:400; }
  .calendar-toolbar-actions { margin:0; }
  .calendar-add-event { min-height:48px; font-size:14px; padding:0 16px; }
  .calendar-controls { display:flex; justify-content:space-between; align-items:center; gap:16px; min-width:0; }
  .calendar-modes .segment { padding:0 14px; min-height:48px; }
  .calendar-navigation { display:flex; gap:6px; min-width:0; }
  .calendar-navigation button { width:44px; min-width:44px; min-height:48px; padding:0; border:0; border-radius:50%; background:var(--daily-soft); font-size:14px; font-weight:400; }
  .calendar-navigation [data-calendar-nav="today"] { width:auto; min-width:62px; background:transparent; color:var(--daily-accent); }
  .calendar-navigation strong { display:none; }
  .calendar-navigation [data-calendar-refresh] { width:48px; min-width:48px; color:var(--daily-muted); background:transparent; }
  .calendar-person-filters { gap:8px; }
  .calendar-person-filter { min-height:48px; padding:0 13px; border:1px solid var(--daily-line); border-radius:24px; background:var(--daily-surface); color:var(--daily-text); font-size:13px; font-weight:400; gap:8px; }
  .calendar-person-filter.is-selected { background:var(--daily-surface); color:var(--daily-text); border-color:var(--daily-accent-line); }
  .calendar-person-filter > span { width:8px; height:8px; min-width:8px; background:var(--person-colour); border:0; box-shadow:none; }
  .family-planner-slot { grid-template-rows:148px minmax(0,1fr); gap:24px; }
  .focus-week-picker { height:100%; gap:8px; }
  .family-planner-day { height:100%; min-height:0; padding:14px 7px; border:0; border-radius:20px; background:var(--daily-surface); display:flex; flex-direction:column; align-items:center; text-align:center; gap:10px; }
  .family-planner-day > header { display:flex; flex-direction:column; align-items:center; gap:8px; border:0; padding:0; }
  .family-planner-day > header span { font-size:12px; font-weight:400; text-transform:none; color:var(--daily-muted); }
  .family-planner-day > header strong { font-size:25px; font-weight:400; line-height:1; }
  .family-planner-day > header small { display:none; }
  .family-planner-day.is-selected { border:0; box-shadow:none; background:var(--daily-accent); color:var(--daily-on-accent); }
  .family-planner-day.is-selected header span,.family-planner-day.is-selected header strong,.family-planner-day.is-selected .focus-week-hint,.family-planner-day.is-selected .focus-week-hint small { color:var(--daily-on-accent); }
  .focus-calendar-dots { display:flex; gap:4px; justify-content:center; position:static; min-height:7px; }
  .focus-calendar-dots i { width:7px; height:7px; }
  .family-planner-day.is-selected .focus-calendar-dots i { background:var(--daily-on-accent); }
  .focus-week-hint { display:block; flex:none; min-height:34px; font-size:12px; width:100%; text-align:center; font-weight:400; line-height:1.4; }
  .focus-week-hint small { display:block; font-size:12px; margin-top:3px; }
  .focus-calendar-layout { grid-template-columns:minmax(0,1.3fr) minmax(0,1fr); gap:26px; }
  .focus-calendar-agenda { min-height:0; overflow:auto; }
  .focus-calendar-agenda > header { min-height:32px; margin-bottom:14px; }
  .focus-calendar-agenda h2 { font-size:20px; font-weight:500; }
  .focus-agenda-row { display:grid; grid-template-columns:50px minmax(0,1fr); align-items:start; gap:12px; padding:0; border:0; margin-bottom:10px; }
  .focus-agenda-time { padding-top:20px; display:grid; gap:8px; color:var(--daily-muted); font-size:12px; }
  .focus-agenda-time small { font-size:11px; }
  .family-planner-event.focus-agenda-event { display:flex; align-items:flex-start; gap:12px; padding:16px; min-height:88px; border:0; border-radius:20px; background:var(--daily-surface); color:var(--daily-text); box-shadow:none; }
  .family-planner-event.focus-agenda-event.is-selected { background:var(--daily-accent-soft); }
  .focus-event-token { display:grid; place-items:center; width:34px; height:34px; min-width:34px; border-radius:12px; background:color-mix(in srgb,var(--calendar-colour) 10%,var(--daily-surface)); color:var(--calendar-colour); }
  .focus-event-token .hub-outline-icon { width:20px; height:20px; }
  .focus-event-copy { min-width:0; flex:1; display:grid; gap:5px; }
  .family-planner-event.focus-agenda-event strong { font-weight:500; font-size:16px; }
  .family-planner-event.focus-agenda-event small { font-size:12px; color:var(--daily-muted); }
  .focus-event-chevron { flex:none; --mdc-icon-size:18px; }
  .planner-ready-state { padding:0; background:transparent; color:var(--daily-accent); font-weight:400; font-size:12px; }
  .focus-event-ready { padding:22px; border-radius:24px; background:var(--daily-surface); overflow:auto; }
  .focus-event-ready h2 { font-size:22px; font-weight:500; margin:10px 0 12px; }
  .focus-prep-icon { width:44px; height:44px; display:grid; place-items:center; padding:11px; border-radius:15px; background:var(--daily-accent-soft); color:var(--daily-accent); }
  .focus-event-ready .eyebrow { margin:12px 0 0; }
  .focus-event-ready .supporting { font-size:12px; }
  .focus-event-ready .focus-checklist { margin-top:12px; gap:0; }
  .focus-event-ready .focus-ready-item { min-height:48px; padding:9px 0; border-radius:0; border:0; border-bottom:1px solid var(--daily-line); background:transparent; font-size:13px; }
  .focus-ready-item.is-complete span { text-decoration:line-through; color:var(--daily-muted); }
  .focus-prep-note { font-size:11px; color:var(--daily-muted); margin:12px 0; }
  .focus-prep-add { display:flex; gap:8px; }
  .focus-prep-add input { min-width:0; width:100%; border:1px solid var(--daily-line); background:var(--daily-soft); color:var(--daily-text); border-radius:10px; padding:10px; font:inherit; font-size:12px; }
  .focus-prep-add button { width:44px; height:44px; flex:none; border:0; border-radius:50%; background:var(--daily-soft); color:var(--daily-text); }
  .focus-prep-links { margin-top:12px; }

  .football-experience,.football-experience.is-fpl { position:relative; grid-template-rows:230px minmax(0,1fr); gap:18px; }
  .football-overview-heading { position:absolute; top:-72px; right:0; }
  .football-freshness { background:transparent; padding:0; color:var(--daily-success); }
  .football-freshness strong { color:inherit; font-size:12px; font-weight:400; }
  .football-freshness small { display:none; }
  .football-club-overviews { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:18px; min-height:0; }
  .football-layout,.football-layout.is-fpl { grid-template-columns:minmax(0,1fr); gap:0; min-height:0; }
  .football-main,.football-layout.is-fpl .football-main { display:grid; grid-template-rows:48px 48px minmax(0,1fr); padding:0; gap:12px; background:transparent; box-shadow:none; min-height:0; overflow:hidden; }
  .football-tabs { margin:0; width:100%; justify-content:flex-start; }
  .football-tabs .segment { flex:none; min-height:48px; padding:0 14px; font-size:14px; }
  .football-toolbar { align-items:center; justify-content:space-between; flex-wrap:nowrap; gap:12px; }
  .football-toolbar h2 { margin:0; font-size:18px; font-weight:500; letter-spacing:-.035em; }
  .matchweek-controls { display:flex; align-items:center; gap:4px; }
  .matchweek-controls button { border:0; background:transparent; color:var(--daily-muted); border-radius:50%; min-width:36px; width:36px; flex-basis:36px; min-height:48px; }
  .matchweek-controls select { min-height:48px; padding:0 6px; border:0; background:transparent; color:var(--daily-muted); font-size:12px; }
  .fixture-day h3 { margin:5px 0 0; font-size:11px; color:var(--daily-muted); font-weight:500; letter-spacing:.06em; }
  .fixture { min-height:70px; padding:13px 0; border:0; border-bottom:1px solid var(--daily-line); border-radius:0; background:transparent; }
  .fixture.is-family-derby,.fixture.is-spotlight,.fixture.is-live { border-right:0; border-left:0; box-shadow:none; background:transparent; }
  .fixture .team { font-size:14px; font-weight:400; }
  .fixture-score { font-size:22px; font-weight:400; }
  .fixture-score small,.scorers { font-size:11px; font-weight:400; }
  .football-experience.is-fpl { grid-template-rows:minmax(0,1fr); }
  .football-experience.is-fpl .football-club-overviews { display:none; }
  .fpl-detail { grid-template-rows:48px auto minmax(0,1fr); }
  .fpl-scoreboard span { background:var(--daily-surface); border-radius:14px; }
  .fpl-player { background:transparent; border:0; box-shadow:none; }
  .fpl-player strong { background:var(--daily-surface); color:var(--daily-text); border-radius:6px; font-size:12px; font-weight:500; padding:5px; }
  .fpl-pitch { background:#DCE8DF; }
  .hub-card[data-appearance="dark"] .fpl-pitch { background:#244130; }
  .fpl-bench { background:var(--daily-success-soft); }

  .home-segments .segment { font-size:13px; font-weight:400; }
  .whole-home-heading h3,.heating-card h3,.cover-card h3 { font-weight:500; font-size:16px; }
  .whole-home-card,.cover-card { border:0; background:var(--daily-surface); box-shadow:none; }
  .light-device { border:0; border-top:1px solid var(--daily-line); border-radius:0; background:transparent; padding:12px 0; }
  .light-device-heading .light-control-icon,.heating-icon { background:var(--daily-soft); color:var(--daily-muted); }
  .light-device-heading strong { font-weight:400; font-size:13px; }
  .light-dimmer { margin-top:12px; }
  .light-dimmer input { accent-color:var(--daily-accent); }
  .heating-card { padding:14px; border:0; background:var(--daily-soft); box-shadow:none; }
  .heating-card.is-on { background:var(--daily-warning-soft); }
  .heating-card-heading { min-height:48px; align-items:start; }
  .heating-card-heading h3 { font-size:16px; }
  .heating-body { justify-content:center; gap:3px; }
  .thermostat-dial { flex:0 0 70px; width:90px; height:70px; min-height:70px; margin:0 auto; }
  .thermostat-dial > div { gap:4px; }
  .thermostat-dial .heating-target-value { font-size:24px; font-weight:400; }
  .thermostat-dial small { font-size:12px; }
  .heating-inside { margin:0 0 4px; text-align:center; font-size:12px; line-height:1.5; color:var(--daily-muted); }
  .heating-inside .heating-current-value { display:inline; font-size:12px; font-weight:400; color:inherit; }
  .heating-schedule { background:var(--daily-surface); }
  .heating-schedule summary strong { font-weight:500; }
  .heating-master-actions button { font-weight:500; }
  .master-temperature-stepper input { font-weight:400; }
  .heating-master { padding:22px; }
  .floorplan-panel,.room-controls { border:0; background:var(--daily-surface); }
  .room-control-button,.room-media-player { background:transparent; border:0; border-top:1px solid var(--daily-line); border-radius:0; }
  .room-control-button strong { font-weight:400; }
  .floorplan-heading h2,.room-controls h2 { font-weight:500; }
  .family-person,.chore-row.is-kid-card { border:0; background:transparent; }
  .chore-row.is-kid-card { padding:15px 0; border-bottom:1px solid var(--daily-line); border-radius:0; }
  .chore-row.is-kid-card strong { font-weight:500; }
  .chore-check { background:var(--daily-soft); color:var(--daily-text); }
  .family-person-header strong,.kid-mission strong { font-weight:500; }
  .family-kid-switcher button { border-radius:24px; font-weight:400; }
  .family-person.is-kid-mode .person-initial { background:color-mix(in srgb,var(--person-colour) 10%,var(--daily-surface)); border:0; box-shadow:none; color:var(--person-colour); }
  .family-prep-item { border:0; border-bottom:1px solid var(--daily-line); border-radius:0; background:transparent; }
  .family-prep-item strong { font-weight:400; }
  .reward-card,.badge-card,.achievement-card { border:0; box-shadow:none; background:var(--daily-surface); }
  .security-stage,.alarm-panel,.garage-panel { background:var(--daily-surface); border:0; box-shadow:none; }
  .stage-privacy { background:var(--daily-soft); font-weight:400; }
  .alarm-panel h2,.garage-panel h2,.security-stage h2,.security-card-heading h2 { font-weight:500; }
  .alarm-actions button { font-weight:400; }
  .security-camera { box-shadow:none; background:var(--daily-surface); border:0; }
  .security-camera.is-selected { outline:1px solid var(--daily-accent-line); outline-offset:-1px; }
  .security-signals strong { font-weight:400; }
  .energy-meter,.energy-history-card { background:var(--daily-surface); border:0; box-shadow:none; }
  .energy-primary-metrics strong { font-weight:400; }
  .energy-meter-heading strong,.energy-history-card h3 { font-weight:500; }
  .energy-hero { background:transparent; padding:0; border:0; box-shadow:none; }
  .energy-hero h2 { font-weight:400; }
  .energy-history-card { padding:18px; }
  .music-heading { display:none; }
  .media-player-panel { grid-template-rows:minmax(0,1fr); padding:0; background:transparent; }
  .media-player-stage { border-radius:24px; background:var(--daily-surface); }

  @media (orientation:portrait), (max-width:850px) {
    .hub-masthead { padding:0 18px; }
    .hub-masthead-status { gap:10px; }
    .hub-shell { grid-template-columns:80px minmax(0,1fr); grid-template-rows:minmax(0,1fr); }
    .hub-navigation { flex-direction:column; padding:16px 8px; gap:6px; border:0; }
    .hub-brand,.hub-nav-button { flex:0 0 auto; width:100%; min-height:60px; }
    .hub-content { padding:24px 22px 18px; grid-template-rows:60px minmax(0,1fr); gap:20px; }
    .today-grid.focus-today,.today-grid.focus-today:has(.today-football) { grid-template-columns:minmax(0,1.1fr) minmax(0,1fr); grid-template-rows:minmax(270px,1fr) minmax(200px,.75fr) 175px 48px; gap:18px; }
    .focus-home-card .today-hero-copy h2 { font-size:27px; }
    .focus-today .today-next { grid-column:1; grid-row:2; overflow:auto; }
    .focus-today .today-family { grid-column:2; grid-row:2; overflow:auto; }
    .focus-today .today-next h2 { font-size:23px; }
    .focus-today .today-next .text-action { align-self:flex-start; margin:0; }
    .focus-today .today-football { grid-row:3; }
    .hero-metrics.focus-home-summary { grid-row:4; }
    .club-overview.is-compact .club-next-row { flex-wrap:wrap; }
    .club-overview.is-compact .club-next-row > small { text-align:left; }
    .calendar-view { padding:0; }
    .calendar-controls { gap:8px; }
    .calendar-modes .segment { padding:0 10px; }
    .calendar-navigation [data-calendar-refresh] { display:none; }
    .family-planner-slot { grid-template-rows:148px minmax(0,1fr); }
    .focus-calendar-layout { grid-template-columns:1fr; grid-template-rows:auto minmax(0,1fr); gap:20px; overflow:auto; }
    .focus-event-ready { min-height:300px; padding:22px; }
    .focus-calendar-agenda { overflow:visible; }
    .heating-card { padding:13px; }
    .thermostat-dial { width:125px; height:112px; flex-basis:112px; }
    .heating-master { padding:16px; }
    .football-layout { grid-template-columns:minmax(0,1fr); }
    .football-toolbar h2 { font-size:18px; }
    .media-player-panel { grid-template-rows:minmax(0,1fr); }
  }
  @media (max-width:620px) {
    .hub-card { grid-template-rows:52px minmax(0,1fr) auto; }
    .hub-masthead { padding:0 12px; }
    .hub-masthead-date,.hub-profile { display:none; }
    .hub-masthead-brand { font-size:17px; }
    .hub-masthead-status { font-size:11px; gap:4px; }
    .hub-shell { grid-template-columns:minmax(0,1fr); grid-template-rows:64px minmax(0,1fr); }
    .hub-navigation { flex-direction:row; padding:4px 8px; gap:4px; border-bottom:1px solid var(--daily-line); }
    .hub-brand,.hub-nav-button { flex:0 0 60px; min-height:52px; }
    .hub-content { padding:18px 14px; grid-template-rows:auto minmax(0,1fr); gap:18px; }
    .hub-topbar h1 { font-size:28px; }
    .hub-topbar-date { font-size:12px; }
    .hub-view { overflow:auto; }
    .today-grid.focus-today,.today-grid.focus-today:has(.today-football) { display:flex; height:auto; min-height:100%; gap:22px; }
    .today-grid.focus-today .focus-home-card { height:280px; min-height:280px; }
    .focus-today .today-family { overflow:visible; }
    .focus-today .today-football { display:block; }
    .focus-today .today-football .featured-fixtures { grid-template-columns:1fr; margin-top:12px; }
    .hero-metrics.focus-home-summary { min-height:48px; }
    .calendar-view { height:auto; min-height:100%; grid-template-rows:auto auto auto auto; gap:18px; }
    .calendar-context h2.focus-calendar-title { font-size:27px; }
    .calendar-toolbar { gap:12px; flex-wrap:wrap; }
    .calendar-controls { flex-wrap:wrap; }
    .calendar-modes { flex:1; }
    .calendar-modes .segment { padding:0 10px; font-size:13px; }
    .calendar-person-filters { flex-wrap:wrap; }
    .family-planner-slot { height:auto; min-height:0; grid-template-rows:135px auto; overflow:visible; }
    .focus-week-picker { gap:4px; }
    .family-planner-day { padding:12px 3px; border-radius:14px; }
    .family-planner-day > header span { font-size:11px; }
    .family-planner-day > header strong { font-size:22px; }
    .focus-week-hint { display:none; }
    .focus-calendar-layout { overflow:visible; grid-template-rows:auto auto; }
    .focus-agenda-row { grid-template-columns:42px minmax(0,1fr); gap:8px; }
    .family-planner-event.focus-agenda-event { padding:14px; }
    .focus-event-token { display:none; }
    .football-experience,.football-experience.is-fpl { height:auto; min-height:100%; grid-template-rows:auto auto auto; }
    .football-overview-heading { position:static; }
    .football-club-overviews { grid-template-columns:1fr; }
    .football-main { min-height:350px; grid-template-rows:auto auto minmax(200px,1fr); }
    .football-toolbar { flex-wrap:wrap; }
    .football-toolbar h2 { flex:1 1 150px; }
    .football-tabs .segment { padding:0 10px; }
    .heating-inside { margin-bottom:8px; }
    .thermostat-dial { width:145px; height:130px; flex-basis:130px; }
    .media-player-panel { min-height:600px; grid-template-rows:minmax(560px,1fr); }
  }


  .family-planner-event.focus-agenda-event { flex-direction:row; }
  .family-planner-event.focus-agenda-event::before { content:none; }
  .focus-event-copy strong,.focus-event-copy small { width:auto; white-space:normal; overflow:visible; }
  .calendar-context strong { display:block; color:var(--daily-muted); }
  .heating-card { display:flex; flex-direction:column; gap:8px; }
  .heating-card .heating-body { display:flex; flex-direction:column; gap:0; flex:none; min-height:0; justify-content:center; }
  .heating-card .heating-target-control { width:100%; flex:none; }
  .heating-card .heating-stepper button { height:48px; padding:0; line-height:1; }
  .heating-card .heating-inside { width:100%; min-height:18px; flex:none; margin:0; }
  .heating-card .heating-schedule { width:100%; flex:none; }
  .football-club-overviews .club-overview { overflow:auto; }
  .club-overview header .team-mark { flex:none; }
  .club-overview header h2 { display:block; }
  .club-overview header div { display:block; }
  .club-overview .club-match-row { color:var(--daily-text); }
  .focus-today .today-family .today-ready-preview { margin-top:6px; }
  .today-ready-preview > summary { display:flex; align-items:center; justify-content:space-between; min-height:48px; cursor:pointer; list-style:none; }
  .today-ready-preview:not([open]) .today-ready-list,.today-ready-preview:not([open]) .today-ready-more { display:none; }
  .focus-prep-icon ha-icon { --mdc-icon-size:22px; }
  .football-experience .fixture.is-spotlight.is-family-derby,.football-experience .fixture.is-spotlight,.football-experience .fixture.is-live { background:transparent; border:0; border-bottom:1px solid var(--daily-line); box-shadow:none; }
  .football-experience .fixture::before,.football-experience .fixture::after { content:none; }
  .matchweek-controls label { position:relative; display:flex; align-items:center; }
  .matchweek-controls label ha-icon { position:absolute; right:6px; pointer-events:none; --mdc-icon-size:16px; }
  .matchweek-controls select { padding-right:26px; appearance:none; }

  .hub-card button,.hub-card select { min-height:48px; min-width:48px; }
  .hub-card .today-job { grid-template-columns:42px minmax(0,1fr) 48px; }
  .hub-card .today-job-action { width:48px; height:48px; }
  .hero-metrics.focus-home-summary button { min-height:48px; }
  @media (min-width:851px) and (orientation:landscape) { .today-grid.focus-today,.today-grid.focus-today:has(.today-football) { grid-template-rows:minmax(0,1fr) 175px 48px; } }
  @media (max-width:620px) { .hub-card button.family-planner-day { min-width:0; } }
  .hub-card .focus-prep-note,.hub-card .focus-agenda-time small,.hub-card .fixture-day h3,.hub-card .fixture-score small,.hub-card .scorers { font-size:12px; }
  @media (orientation:landscape) and (max-height:900px) {
    .focus-event-ready { padding:18px; }
    .focus-prep-icon { float:right; width:36px; height:36px; padding:7px; }
    .focus-event-ready .eyebrow { margin:0; }
    .focus-event-ready h2 { margin:8px 0; font-size:20px; }
    .focus-event-ready .supporting { margin:3px 0; }
    .focus-event-ready .focus-checklist { margin-top:10px; }
    .focus-event-ready .focus-ready-person { display:none; }
  }

  .energy-hero h2,.energy-hero-status strong { color:var(--daily-text); }
  .energy-hero .eyebrow,.energy-hero p:last-child,.energy-hero-status small { color:var(--daily-muted); }
  .energy-hero-status { background:var(--daily-surface); border:0; }
  .energy-hero-status ha-icon { color:var(--daily-accent); }
  .family-dashboard-heading h2,.family-kid-tab,.chore-heading h3,.reward-presentation strong { font-weight:500; }
  .camera-stage-action b { background:var(--daily-accent); color:var(--daily-on-accent); }
  .camera-tile-media .camera-poster-caption { display:none; }
  .camera-tile-media .camera-poster-action { padding:5px; }
  .camera-tile-media .camera-poster-action > span { width:100%; font-size:12px; font-weight:500; }
  @media (min-width:851px) and (orientation:landscape) {
    .focus-today .today-next { padding-bottom:0 !important; }
    .focus-today .today-next h2 { margin:4px 0 6px; font-size:22px; }
    .focus-today .today-next .focus-checklist { margin-top:6px; }
    .focus-today .today-next:not(:has(.focus-ready-count)) .text-action { margin:8px 0 0; }
    .today-job { min-height:48px; padding:0; }
    .focus-today .today-football { grid-template-rows:48px minmax(0,1fr); gap:2px; }
    .club-overview.is-compact > header { margin-bottom:0; }
    .club-overview.is-compact .club-match-row { padding:2px 0; }
    .club-overview.is-compact .club-next-row > small { max-width:105px; }
  }
  .chore-row b { color:var(--daily-text); }

  .chore-row.is-kid-card > b { color:var(--daily-text); background:var(--daily-soft); }
  .energy-view { grid-template-rows:100px 240px minmax(0,1fr) auto; }
  .energy-hero { overflow:visible; }
  .energy-meter { gap:8px; grid-template-rows:auto auto auto auto; align-content:start; overflow:auto; }
  .energy-primary-metrics,.energy-tariff { margin-top:0; }
  .energy-primary-metrics > span { padding:10px; }
  .energy-tariff { padding-top:8px; }
  @media (min-width:851px) and (orientation:landscape) {
    .focus-today .today-next h2 { margin-bottom:2px; }
    .focus-today .today-next .focus-checklist { margin-top:5px; }
    .focus-today .today-next .focus-ready-count { margin-top:0; }
  }

  .energy-meter { padding:12px; }
  .energy-history-card { grid-template-rows:40px minmax(0,1fr); }
  .security-stage .camera-stage-action b { background:var(--daily-accent); color:var(--daily-on-accent); font-weight:500; }
  .focus-ready-item.is-complete ha-icon { color:var(--daily-accent); }
  .family-kid-tab strong,.reward-claim { font-weight:500; }
  @media (min-width:851px) and (max-height:790px) and (orientation:landscape) {
    .hub-content:has(.heating-experience) { padding-top:6px; padding-bottom:6px; grid-template-rows:48px minmax(0,1fr); gap:8px; }
    .home-surface:has(.heating-experience) { grid-template-rows:48px minmax(0,1fr); gap:4px; }
    .home-surface:has(.heating-experience) .home-segments { padding:0; }
  }
  /* Room targets use the same centred dial and side buttons as Master heating. */
  .heating-card .heating-body { flex:1; justify-content:center; gap:6px; }
  .heating-card .heating-stepper { position:relative; display:block; margin:0; }
  .heating-card .thermostat-dial { width:112px; height:112px; min-height:112px; margin:0 auto; }
  .heating-card .heating-stepper button { position:absolute; top:50%; transform:translateY(-50%); z-index:1; width:48px; height:48px; border-radius:50%; background:var(--daily-soft); color:var(--daily-text); }
  .heating-card .heating-stepper button:first-child { left:0; }
  .heating-card .heating-stepper button:last-child { right:0; }
  @media (max-width:850px) {
    .heating-card .thermostat-dial { width:125px; height:125px; min-height:125px; }
  }
  @media (max-width:620px) {
    .heating-grid { grid-template-columns:1fr; }
    .heating-card .thermostat-dial { width:145px; height:145px; min-height:145px; }
  }

  .heating-schedule.schedule-open-action { display:flex; align-items:center; justify-content:space-between; width:100%; min-height:48px; border:0; border-radius:12px; padding:8px 10px; background:var(--daily-surface); color:var(--daily-text); text-align:left; }
  .schedule-open-action > span { display:grid; grid-template-columns:24px 1fr; align-items:center; gap:4px 8px; }
  .schedule-open-action strong { font-size:14px; font-weight:500; }
  .schedule-open-action small { display:none; }
  .schedule-open-action ha-icon { color:var(--daily-accent); width:22px; height:22px; }
  .heating-master .schedule-open-action { background:var(--daily-soft); margin-top:16px; }
  .schedule-open-action:hover,.schedule-open-action:focus-visible { background:var(--daily-accent-soft); outline:2px solid var(--daily-accent); outline-offset:2px; }
  .heating-schedule-modal { width:min(680px,calc(100% - 32px)); max-height:calc(100% - 32px); }
  .heating-schedule-modal > header { background:var(--daily-surface); padding:22px 26px 18px; }
  .heating-schedule-modal > header h2 { font-size:26px; margin:6px 48px 8px 0; }
  .heating-schedule-modal > header p:last-child { line-height:1.5; margin:0 42px 0 0; }
  .heating-schedule-modal .planner-modal-body { padding:18px 26px; }
  .heating-schedule-modal .schedule-periods { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
  .heating-schedule-modal .schedule-period { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin:0; padding:10px 16px 14px; border:1px solid var(--daily-line); border-radius:16px; background:var(--daily-soft); }
  .heating-schedule-modal .schedule-period legend { display:flex; align-items:center; gap:8px; width:auto; padding:0 6px; font-size:15px; }
  .heating-schedule-modal .schedule-period legend span { width:26px; height:26px; display:grid; place-items:center; border-radius:8px; background:var(--daily-accent-soft); color:var(--daily-accent); }
  .heating-schedule-modal .schedule-period legend small { color:var(--daily-muted); }
  .heating-schedule-modal .schedule-period label { display:grid; gap:5px; }
  .heating-schedule-modal .schedule-period label > span:first-child { font-size:13px; font-weight:500; color:var(--daily-muted); }
  .heating-schedule-modal .schedule-period input { width:100%; min-width:0; min-height:48px; padding:8px 12px; border:1px solid var(--daily-line); border-radius:10px; background:var(--daily-surface); color:var(--daily-text); font:inherit; }
  .heating-schedule-modal .schedule-temp { display:flex; align-items:center; gap:8px; }
  .heating-schedule-modal .schedule-temp b { font-weight:400; }
  .heating-schedule-modal > footer { display:flex; justify-content:flex-end; gap:12px; padding:16px 26px; background:var(--daily-surface); }
  .heating-schedule-modal > footer button { min-height:48px; border:0; padding:10px 20px; border-radius:12px; background:var(--daily-soft); color:var(--daily-text); }
  .heating-schedule-modal > footer [data-heating-schedule-apply] { background:var(--daily-accent); color:white; }
  .heating-schedule-modal .schedule-error { color:#a4342f; line-height:1.5; }
  .heating-schedule-modal .schedule-editor { border:0; padding:0; margin:0; }
  .heating-schedule-modal .schedule-temp { border:0; background:transparent; padding:0; }
  @media (max-width:620px) {
    .heating-schedule-modal .schedule-periods { grid-template-columns:1fr; }
    .heating-schedule-modal > header,.heating-schedule-modal .planner-modal-body,.heating-schedule-modal > footer { padding:16px; }
  }
  .heating-card.is-off .heating-target-control { opacity:1; }
  .heating-card.is-off .heating-stepper button { background:var(--daily-surface); }
  .heating-card.is-off .thermostat-track { stroke:var(--daily-surface); }

  /* A single content area per task: navigation and primary actions stay visible. */
  .ux-section[hidden] { display:none !important; }
  .detail-segments,.task-section-tabs { display:flex; gap:4px; padding:4px; background:var(--daily-soft); border-radius:16px; }
  .detail-segments .segment,.task-section-tabs .segment { flex:1; min-width:0; padding:0 8px; font-size:13px; white-space:nowrap; }
  .segment:hover:not(:disabled),.control-main:hover:not(:disabled),.icon-action:hover:not(:disabled) { background:var(--daily-accent-soft); }
  .hub-card button:focus-visible,.hub-card select:focus-visible,.hub-card input:focus-visible { outline:3px solid var(--daily-accent); outline-offset:2px; }
  .hub-card button:active:not(:disabled) { filter:brightness(.96); }
  .room-detail.home-drawer { display:flex; flex-direction:column; gap:12px; overflow:hidden; }
  .room-detail .room-title { flex:none; margin:0; }
  .room-detail .room-title h2 { font-size:22px; }
  .room-detail .detail-segments { flex:none; }
  .room-section-content { min-height:0; flex:1; overflow:auto; overscroll-behavior:contain; }
  .room-section-content .room-control-list { margin:0; }
  .room-section-content .scene-button { width:100%; margin-bottom:8px; }
  .room-section-content .media-room-control { width:100%; }
  .family-dashboard.has-kid-switcher { grid-template-rows:48px 48px minmax(0,1fr); gap:10px; }
  .family-dashboard-heading .task-section-tabs { flex:1; max-width:460px; }
  .family-kid-stage .family-person.is-kid-mode { padding:0; grid-template-rows:64px minmax(0,1fr); gap:12px; }
  .kid-mission-orbit.progress-ring { width:58px; height:58px; flex-basis:58px; }
  .progress-ring > span { width:48px; height:48px; font-size:18px; }
  .kid-mission p { margin:0; }
  .kid-mission strong { font-size:17px; }
  .focus-task-workspace.is-sectioned { display:block; }
  .focus-task-workspace.is-sectioned > .ux-section { height:100%; overflow:auto; overscroll-behavior:contain; padding:0 4px 0 0; }
  .focus-task-workspace.is-sectioned .family-preparation { margin:0; }
  .focus-task-workspace.is-sectioned .family-summary-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:14px; }
  .focus-task-workspace.is-sectioned .family-summary-item { align-content:start; grid-template-columns:1fr; min-height:0; padding:20px; gap:16px; }
  .focus-task-workspace.is-sectioned .award-reward { min-height:0; }
  .cleaning-experience .cleaning-panel { padding:18px; gap:16px; overflow:hidden; }
  .cleaning-hero { flex:none; }
  .cleaning-hero > span { width:52px; height:52px; }
  .cleaning-hero h2 { font-size:22px; }
  .cleaning-section { min-height:0; overflow:auto; overscroll-behavior:contain; }
  .cleaning-section .cleaning-facts { margin:0 0 16px; grid-template-columns:repeat(3,minmax(0,1fr)); }
  .cleaning-section .cleaning-actions { display:flex; flex-wrap:wrap; gap:8px; }
  .cleaning-section .cleaning-actions button { flex:1; white-space:nowrap; }
  .cleaning-selectors { gap:12px; }
  .cleaning-selectors select { font:inherit; font-size:14px; }
  .whole-home-grid { grid-auto-rows:max-content; align-content:start; }
  .whole-home-card { overflow:visible; }
  .whole-home-heading { min-height:48px; }
  .whole-home-controls { gap:0; margin-top:8px; }
  .light-device { padding:6px 0; }
  .light-dimmer { min-height:48px; padding:0 4px; margin:0; }
  .light-dimmer input { height:48px; }
  .light-dimmer input::-webkit-slider-runnable-track { background:linear-gradient(90deg,var(--daily-accent) 0 var(--light-level),var(--daily-line) var(--light-level) 100%); }
  .light-dimmer input::-webkit-slider-thumb { background:var(--daily-accent); }
  .light-dimmer input::-moz-range-progress,.light-dimmer input::-moz-range-thumb { background:var(--daily-accent); }
  .energy-view { grid-template-rows:84px 212px minmax(0,1fr) auto; gap:10px; }
  .energy-truth-note { padding:8px 12px; }
  .energy-history-card { padding:12px; grid-template-rows:32px minmax(0,1fr); overflow:hidden; }
  .energy-history-slot { overflow:hidden; }
  .energy-history-card h2 { font-size:17px; }
  .football-experience { grid-template-rows:188px minmax(0,1fr); gap:14px; }
  .football-club-overviews .club-overview { padding:14px 18px; overflow:visible; }
  .football-club-overviews .club-overview > header { margin:0 0 4px; gap:10px; }
  .football-club-overviews .club-overview header .team-mark { width:34px; height:34px; min-width:34px; }
  .football-club-overviews .club-overview header h2 { font-size:20px; }
  .football-club-overviews .club-overview header small { display:none; }
  .football-club-overviews .club-overview > .eyebrow { margin:0; font-size:12px; }
  .football-club-overviews .club-match-row { padding:6px 0; min-height:52px; }
  .football-experience.is-table { grid-template-rows:minmax(0,1fr); }
  .football-experience.is-table .football-club-overviews { display:none; }
  .football-main { gap:8px; }
  .fixture { padding:10px 0; min-height:64px; }
  .fixture-groups,.league-table-wrap,.fpl-leagues { overscroll-behavior:contain; }
  .fpl-detail { grid-template-rows:48px 74px minmax(0,1fr); gap:10px; }
  .football-experience.is-fpl .football-main { grid-template-rows:48px minmax(0,1fr); }
  .football-experience.is-fpl .football-toolbar { display:none; }
  .fpl-team-card { display:grid; grid-template-columns:minmax(140px,1fr) minmax(0,3fr); align-items:center; gap:12px; padding:8px 14px; }
  .fpl-scoreboard { margin:0; gap:8px; }
  .fpl-scoreboard span { padding:4px; background:transparent; }
  .fpl-scoreboard strong { font-size:22px; }
  .fpl-team-card .fpl-chip { grid-column:1/-1; margin:0; }
  .fpl-detail:has(.fpl-chip) { grid-template-rows:48px 104px minmax(0,1fr); }
  .fpl-squad-panel { display:grid; grid-template-rows:36px 48px minmax(0,1fr); gap:8px; overflow:hidden; }
  .fpl-squad-panel .section-heading { min-height:0; margin:0; }
  .fpl-squad-panel .section-heading .eyebrow { display:none; }
  .fpl-pitch { min-height:0; height:100%; display:grid; grid-template-rows:repeat(4,minmax(0,1fr)); gap:2px; padding:4px; }
  .fpl-pitch-row { min-height:0; align-items:center; gap:3px; }
  .fpl-player { min-height:0; width:clamp(52px,6.3vw,76px); grid-template-rows:22px auto; gap:0; padding:0 2px; }
  .fpl-player-mark { width:22px; height:22px; }
  .fpl-player-mark img { width:20px; height:20px; inset:1px; }
  .fpl-player strong { font-size:12px; padding:2px 4px; min-height:0; line-height:1.15; }
  .fpl-player small { display:none; }
  .fpl-player em { font-size:12px; min-width:20px; bottom:0; right:0; padding:2px; }
  .fpl-player-badge { width:18px; height:18px; font-size:12px; top:0; left:0; }
  .fpl-player-warning { --mdc-icon-size:15px; top:0; right:0; }
  .fpl-bench { align-content:center; margin:0; }
  .fpl-bench .fpl-player { min-height:100px; grid-template-rows:40px auto auto; }
  .fpl-bench .fpl-player-mark { width:36px; height:36px; }
  .fpl-bench .fpl-player-mark img { width:32px; height:32px; }
  .fpl-bench .fpl-player strong { font-size:13px; line-height:1.3; }
  .fpl-bench .fpl-player small { display:block; }
  .fpl-league-panel { display:grid; grid-template-rows:36px minmax(0,1fr); gap:8px; overflow:hidden; }
  .fpl-leagues { overflow:auto; min-height:0; }
  .fpl-league-panel .section-heading { margin:0; min-height:0; }
  .fpl-league-panel .section-heading .eyebrow { display:none; }
  .media-player-stage,.media-player-stage .child-card-slot { overflow:hidden; }
  .whole-home-card { padding:8px; }
  .whole-home-controls { margin-top:4px; }
  .light-device { padding:0; }
  .light-device .whole-home-control { min-height:48px; padding:5px 6px; }
  .energy-view { grid-template-rows:84px 228px minmax(0,1fr) auto; }
  .energy-meter { overflow:visible; }
  .fpl-pitch { margin:0; padding:8px 4px; }
  .fpl-player { padding-bottom:0; }
  .fpl-player em { position:absolute; top:2px; right:0; bottom:auto; }
  .fpl-bench .fpl-player em { position:static; }
  .focus-today .today-next .focus-checklist { min-height:48px; flex:none; max-height:none; overflow:visible; }
  .focus-today-plan:has(.today-ready-preview[open]) { overflow:auto; }
  @media (min-width:851px) and (orientation:landscape) {
    .today-grid.focus-today,.today-grid.focus-today:has(.today-football) { grid-template-rows:minmax(0,1fr) 175px 48px; gap:12px 24px; }
    .focus-today-plan { grid-template-rows:minmax(0,1fr) 152px; gap:4px; }
    .focus-today .today-family { overflow:visible; }
    .focus-today .today-family .section-heading { min-height:48px; margin:0; }
    .focus-today .today-family .section-heading h2 { font-size:17px; }
    .focus-today .today-family .section-heading button { min-height:48px; }
    .focus-today .today-next .focus-checklist { flex-wrap:nowrap; }
    .focus-today .today-next .focus-ready-item { flex:1; min-width:0; font-size:12px; padding:6px; }
  }
  @media (min-width:621px) {
    .calendar-view { grid-template-rows:48px 48px 48px minmax(0,1fr); gap:8px; }
    .calendar-context h2.focus-calendar-title { font-size:27px; margin:0 0 2px; }
    .calendar-context strong { font-size:12px; }
    .family-planner-slot { grid-template-rows:120px minmax(0,1fr); gap:10px; }
    .family-planner-day { padding:8px 5px; border-radius:18px; }
    .family-planner-day > header small { display:none; }
    .family-planner-day > header strong { font-size:24px; }
    .focus-week-hint { font-size:12px; margin-top:4px; }
    .focus-week-hint small { font-size:12px; margin-top:2px; }
    .focus-calendar-layout { grid-template-columns:minmax(0,1.25fr) minmax(0,1fr); grid-template-rows:minmax(0,1fr); gap:18px; overflow:hidden; }
    .focus-calendar-agenda { overflow:auto; }
    .focus-calendar-agenda > header { margin-bottom:8px; }
    .focus-agenda-row { margin-bottom:8px; }
    .family-planner-event.focus-agenda-event { min-height:74px; padding:12px; gap:8px; }
    .family-planner-event.focus-agenda-event strong { font-size:15px; }
    .focus-event-ready { min-height:0; display:flex; flex-direction:column; padding:12px; overflow:hidden; }
    .focus-prep-heading { flex:none; }
    .focus-prep-heading h2 { font-size:18px; margin:4px 0; }
    .focus-prep-heading .supporting { margin:2px 0; }
    .focus-prep-icon { float:right; }
    .focus-prep-heading .eyebrow { margin:0; font-size:12px; }
    .focus-prep-body { min-height:0; flex:1; overflow:auto; overscroll-behavior:contain; }
    .focus-prep-body .focus-checklist { margin-top:4px; }
    .focus-prep-body .focus-prep-note { display:none; }
    .focus-prep-body .focus-ready-count { margin:4px 0; }
    .focus-prep-add input { min-height:48px; }
    .focus-prep-links { flex:none; margin:4px 0 0; }
  }
  @media (orientation:portrait), (max-width:850px) {
    .heating-experience { grid-template-rows:220px minmax(0,1fr); }
    .heating-master { gap:4px 12px; }
    .heating-master .schedule-open-action { margin-top:4px; }
    .room-detail.home-drawer { padding:12px; gap:8px; }
    .room-title .eyebrow { display:none; }
    .cleaning-experience { grid-template-rows:minmax(0,1fr) 200px; }
    .fpl-detail-grid { grid-template-columns:minmax(0,1.6fr) minmax(200px,1fr); }
    .fpl-player { width:clamp(42px,6vw,68px); }
    .fpl-team-card { grid-template-columns:1fr; grid-template-rows:auto auto; gap:4px; }
    .fpl-detail { grid-template-rows:48px 96px minmax(0,1fr); }
  }
  @media (max-width:620px) {
    .focus-task-workspace.is-sectioned .family-summary-grid { grid-template-columns:1fr; }
    .room-section-content,.focus-task-workspace.is-sectioned > .ux-section,.cleaning-section { height:auto; overflow:visible; }
    .room-detail.home-drawer,.cleaning-experience .cleaning-panel { overflow:visible; }
    .fpl-squad-panel { min-height:490px; }
    .fpl-league-panel { height:400px; }
    .fpl-detail,.fpl-detail-grid { display:flex; flex-direction:column; height:auto; }
    .fpl-detail .fpl-scoreboard strong { font-size:18px; }
    .fpl-player { width:16%; }
    .heating-experience { grid-template-rows:auto auto; }
    .focus-calendar-layout { display:flex; flex-direction:column; }
    .focus-prep-body { overflow:visible; }
    .football-experience.is-table { display:block; }
  }
  .media-player-stage .embedded-card { font-family:inherit; }
  .media-player-stage .embedded-card * { font-family:inherit; font-weight:400; }
  .media-player-stage .embedded-card :is(h1,h2,h3,strong,b) { font-weight:500; }

  .focus-prep-add { flex:none; }
  @media (min-width:621px) {
    .focus-event-ready > .focus-prep-note { display:none; }
    .focus-prep-body .focus-ready-count { display:none; }
  }
  @media (min-width:851px) and (orientation:landscape) {
    .hub-content { padding:18px 24px 12px; grid-template-rows:56px minmax(0,1fr); gap:12px; }
    .hub-content:has(.calendar-view) { grid-template-rows:0 minmax(0,1fr); gap:0; }
    .today-grid.focus-today,.today-grid.focus-today:has(.today-football) { grid-template-rows:minmax(0,1fr) 170px 48px; gap:8px 24px; }
    .focus-today-plan { grid-template-rows:minmax(0,1fr) 144px; }
    .focus-today .today-next > :is(h2,p) { flex:none; }
    .club-overview.is-compact > header .team-mark { width:22px; height:22px; min-width:22px; }
    .club-overview.is-compact > header { min-height:22px; }
    .club-overview.is-compact .club-match-row { min-height:48px; padding:2px 0; }
    .lights-experience { grid-template-rows:64px minmax(0,1fr); gap:10px; }
    .lighting-master { padding:8px 14px; }
    .lighting-master .eyebrow { display:none; }
    .whole-home-card { padding:6px; }
  }
  @media (min-width:851px) and (max-width:1100px) and (orientation:landscape) {
    .focus-event-ready { position:relative; }
    .focus-prep-heading { padding-right:48px; }
    .focus-prep-icon { display:none; }
    .focus-prep-links { height:0; min-height:0; margin:0; }
    .focus-prep-links button { position:absolute; width:48px; min-width:48px; padding:0; border-radius:50%; background:var(--daily-soft); }
    .focus-prep-links .prep-link-label { display:none; }
    .focus-prep-links [data-planner-event] { top:12px; right:12px; }
    .focus-prep-links [data-focus-tasks] { bottom:12px; right:12px; width:80px; border-radius:14px; gap:4px; }
    .focus-prep-links [data-focus-tasks] .prep-link-label { display:inline; font-size:12px; }
    .focus-event-ready:has([data-focus-tasks]) .focus-prep-add { padding-right:88px; }
  }
  /* Approved typography: regular body copy, medium headings and light readouts. */
  .hub-card { font-family:var(--family-font-family,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif); font-weight:400; }
  .hub-card button,.hub-card input,.hub-card select,.hub-card label { font-family:inherit; font-weight:400; }
  .hub-card :is(h1,h2,h3,h4,strong,b) { font-weight:500; }
  .hub-topbar h1 { font-size:32px; line-height:1.15; }
  .hub-card :is(.heating-target-value,.master-temperature-stepper input,.heating-current-value,.club-match-row b,.fpl-scoreboard strong,.energy-meter-reading strong) { font-weight:400; }
  @media (max-width:620px) {
    .rooms-layout { min-width:0; grid-template-columns:minmax(0,1fr); }
    .room-detail .detail-segments { flex-wrap:wrap; }
    .room-detail .detail-segments .segment { flex:1 1 40%; }
  }

  /* One viewer and compact choices, regardless of the configured camera count. */
  .security-main { grid-template-rows:88px minmax(0,1fr); }
  .security-camera-picker { display:block; min-width:0; }
  .camera-choice-list { display:grid; height:100%; grid-template-columns:repeat(var(--camera-count),minmax(0,1fr)); gap:10px; }
  .security-camera { display:flex; height:100%; padding:4px; min-width:0; align-items:center; gap:2px; border:1px solid transparent; border-radius:18px; background:var(--daily-surface); box-shadow:none; }
  .security-camera.is-selected { border-color:var(--daily-accent); background:var(--daily-accent-soft); }
  .security-camera .camera-select-action { flex:1 1 0; display:flex; min-width:0; min-height:60px; align-items:center; gap:8px; padding:4px 6px; background:transparent; color:var(--daily-text); border:0; text-align:left; border-radius:12px; }
  .camera-select-action > ha-icon { flex:none; color:var(--daily-accent); --mdc-icon-size:22px; }
  .camera-select-action > span { min-width:0; }
  .camera-select-action strong { display:block; font-size:14px; line-height:1.3; overflow-wrap:break-word; }
  .security-camera .privacy-badge { display:block; margin-top:3px; padding:0; border:0; border-radius:0; background:transparent; color:var(--daily-muted); font-size:12px; line-height:1.25; white-space:normal; }
  .camera-picker-live { flex:none; min-width:48px; min-height:48px; max-width:80px; padding:4px 8px; border:0; border-radius:12px; background:var(--daily-soft); color:var(--daily-accent); font-size:12px; }
  .camera-picker-live { display:grid; place-items:center; width:48px; padding:0; border-radius:50%; }
  .camera-picker-live ha-icon { --mdc-icon-size:24px; }
  .camera-picker-action-label { display:none; }
  .camera-picker-live:disabled { color:var(--daily-muted); }
  .camera-collection-picker { height:100%; display:flex; align-items:center; gap:14px; padding:8px 16px; border-radius:18px; background:var(--daily-surface); }
  .camera-collection-picker > ha-icon { flex:none; --mdc-icon-size:26px; color:var(--daily-accent); }
  .camera-collection-picker > span { flex:1; min-width:0; padding-right:20px; position:relative; }
  .camera-collection-picker > span::after { content:""; position:absolute; right:2px; top:34px; width:8px; height:8px; border-right:2px solid var(--daily-muted); border-bottom:2px solid var(--daily-muted); transform:rotate(45deg); pointer-events:none; }
  .camera-collection-picker small { display:block; color:var(--daily-muted); font-size:12px; }
  .camera-collection-picker select { appearance:none; -webkit-appearance:none; height:48px; width:100%; min-height:48px; border:0; background:transparent; color:var(--daily-text); font-size:16px; padding:0 8px 0 0; }
  .security-stage { grid-template-rows:48px minmax(0,1fr) auto; gap:10px; }
  .security-stage-media,.camera-stage-stack,.camera-poster-slot { background:var(--daily-soft); color:var(--daily-muted); }
  .camera-poster-fallback { color:var(--daily-muted); font-size:14px; }
  .camera-poster-fallback ha-icon { color:var(--daily-accent); }
  .camera-stage-action { padding:14px; gap:12px; background:linear-gradient(transparent 45%,var(--daily-surface) 85%); color:var(--daily-text); }
  .camera-stage-action > span { max-width:calc(100% - 124px); }
  .camera-stage-action strong { font-size:16px; }
  .camera-stage-action small { color:var(--daily-muted); font-size:12px; }
  .camera-stage-action b { background:var(--daily-accent); color:#fff; min-width:108px; min-height:48px; }
  .camera-stage-action:disabled b { background:var(--daily-soft); color:var(--daily-muted); }
  .camera-stream-overlay { background:var(--daily-soft); color:var(--daily-text); }
  .camera-stream-overlay > ha-icon { color:var(--daily-accent); }
  .camera-stream-overlay small { color:var(--daily-muted); }
  .camera-close { background:var(--daily-surface); color:var(--daily-accent); border:1px solid var(--daily-accent); }
  .camera-live-indicator { background:var(--daily-surface); color:var(--daily-text); }
  .security-selected-signals { display:flex; flex-wrap:wrap; gap:8px; }
  .security-selected-signals .security-signal { display:grid; flex:1 1 90px; grid-template-columns:22px auto; grid-template-rows:auto auto; padding:8px 12px; min-height:48px; background:var(--daily-soft); color:var(--daily-text); border:0; border-radius:12px; text-align:left; }
  .security-selected-signals .security-signal ha-icon { grid-row:1 / 3; align-self:center; color:var(--daily-muted); --mdc-icon-size:20px; }
  .security-selected-signals .security-signal.is-active { background:var(--daily-warning-soft); }
  .security-selected-signals .security-signal.is-active ha-icon { color:var(--daily-warning); }
  .security-selected-signals .security-signal small { color:var(--daily-muted); }
  .camera-select-action:focus-visible,.camera-picker-live:focus-visible,.camera-collection-picker select:focus-visible { outline:2px solid var(--daily-accent); outline-offset:2px; }
  @media (max-width:850px) and (min-width:621px) {
    .security-layout { grid-template-rows:minmax(0,1fr) 252px; }
    .security-main { grid-template-rows:88px minmax(0,1fr); }
  }
  @media (max-width:620px) {
    .security-main { display:flex; flex-direction:column; }
    .security-camera-picker { flex:none; }
    .camera-choice-list { height:auto; grid-template-columns:1fr; }
    .security-camera { height:72px; }
    .security-stage { min-height:420px; }
    .security-stage-heading { flex-wrap:wrap; }
    .security-stage { grid-template-rows:auto minmax(0,1fr) auto; }
  }
`;
