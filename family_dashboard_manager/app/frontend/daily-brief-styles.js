// Shared presentation only. Service boundaries, child cards and controls stay in
// family-hub-card. The Home Assistant appearance setting selects the palette.
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
  /* Home in focus: one workspace, persistent navigation and playback. */
  :host { min-height:0; height:calc(100vh - var(--family-ha-header-offset)); }
  .hub-card { display:grid; height:100%; min-height:0; overflow:hidden; grid-template-columns:minmax(0,1fr); grid-template-rows:48px minmax(0,1fr) auto; }
  .focus-app-brand { display:flex; gap:10px; align-items:center; padding:0 24px; border-bottom:1px solid var(--daily-line); background:var(--daily-surface); }
  .focus-app-brand > ha-icon { --mdc-icon-size:23px; }
  .focus-app-brand strong { font-size:16px; font-weight:650; letter-spacing:-.03em; }
  .focus-app-brand span { margin-left:auto; color:var(--daily-muted); font-size:12px; }
  .hub-shell { grid-template-columns:80px minmax(0,1fr); height:100%; min-height:0; overflow:hidden; }
  .hub-navigation { padding:12px 8px; gap:6px; overflow:auto; }
  .hub-nav-items { display:contents; }
  .hub-nav-label { display:none; }
  .hub-brand,.hub-nav-button { flex:0 0 auto; min-height:56px; padding:8px 2px; flex-direction:column; justify-content:center; gap:5px; text-align:center; }
  .hub-brand span,.hub-nav-button span { font-size:11px; font-weight:600; }
  .hub-brand.is-active,.hub-nav-button.is-active { color:var(--daily-accent); }
  .hub-content { display:grid; min-height:0; overflow:hidden; padding:14px 24px 18px; grid-template-rows:50px minmax(0,1fr); gap:16px; }
  .hub-view { min-height:0; overflow:auto; overscroll-behavior:contain; scrollbar-width:thin; }
  .hub-topbar h1 { font-size:30px; }
  .hub-weather-pill { border:1px solid var(--daily-line); min-height:42px; }
  .focus-dock-shell { min-width:0; }
  .focus-dock-shell:empty { display:none; }
  .focus-music-dock.today-music { display:grid; grid-template-columns:44px minmax(120px,1fr) auto auto 100px; gap:12px; margin:0; padding:10px 24px !important; border-top:1px solid var(--daily-line); background:var(--daily-surface); min-height:66px; }
  .focus-music-dock .artwork { width:48px; height:48px; border-radius:9px; background:var(--daily-soft); }
  .focus-dock-track { display:block; min-width:0; min-height:48px; padding:0; background:none; color:var(--daily-text); border:0; text-align:left; cursor:pointer; }
  .focus-dock-track strong,.focus-dock-track small { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .focus-dock-track strong { font-size:13px; font-weight:650; }
  .focus-dock-track small { margin-top:3px; color:var(--daily-muted); font-size:12px; }
  .focus-dock-playback { display:flex; gap:4px; }
  .focus-dock-action { width:48px; height:48px; display:grid; place-items:center; padding:0; border:0; background:none; color:var(--daily-text); border-radius:50%; cursor:pointer; }
  .focus-dock-action.is-play { background:var(--daily-text); color:var(--daily-surface); }
  .focus-dock-action:disabled { opacity:.45; cursor:default; }
  .focus-dock-output { display:flex; gap:6px; align-items:center; color:var(--daily-muted); }
  .focus-dock-output ha-icon { --mdc-icon-size:18px; }
  .focus-dock-output select { max-width:150px; min-height:48px; border:0; background:var(--daily-surface); color:var(--daily-text); font-size:12px; }
  .focus-dock-volume { width:100%; accent-color:var(--daily-text); min-height:48px; }
  .today-grid.focus-today,.today-grid.focus-today:has(.today-football) { display:grid; height:auto; min-height:0; grid-template-columns:minmax(0,1.35fr) minmax(0,1fr); grid-template-rows:auto auto auto; align-items:start; gap:20px; }
  .hero-panel.today-hero.focus-home-card { position:relative; display:block; padding:28px; min-height:380px; grid-column:1; grid-row:1; overflow:hidden; border-radius:24px; background:#232522; }
  .focus-home-card .daily-home-art { position:absolute; inset:0; min-height:0; border-radius:0; }
  .focus-home-card .daily-home-art::after { content:""; position:absolute; inset:0; background:linear-gradient(180deg,rgba(0,0,0,.60),rgba(0,0,0,.08) 48%,rgba(0,0,0,.70)); }
  .focus-home-card .daily-home-art img { object-position:50% 55%; }
  .focus-home-card .today-hero-copy { position:absolute; top:28px; left:28px; right:72px; z-index:1; }
  .focus-home-card .today-hero-copy h2 { color:#fff; margin:0; font-size:36px; line-height:1.12; }
  .focus-home-card .today-hero-copy > p:last-child { color:#fff; margin:8px 0; }
  .focus-home-open { position:absolute; right:20px; top:20px; width:48px; height:48px; border:1px solid #ffffff55; border-radius:50%; background:#0005; color:#fff; }
  .focus-home-controls { display:grid; grid-template-columns:1fr 1fr; gap:10px; position:absolute; left:20px; right:20px; bottom:20px; z-index:1; }
  .focus-home-controls button { display:flex; min-width:0; min-height:72px; align-items:center; gap:10px; padding:12px; border:1px solid #ffffff66; border-radius:16px; background:#fbfbf6eb; color:#202121; text-align:left; cursor:pointer; }
  .focus-home-controls button > ha-icon { --mdc-icon-size:25px; color:#9a6718; }
  .focus-home-controls strong,.focus-home-controls small { display:block; font-size:14px; }
  .focus-home-controls small { margin-top:4px; color:#555954; font-size:12px; }
  .focus-home-controls small ha-icon { --mdc-icon-size:13px; }
  .focus-home-controls button:disabled { opacity:.8; cursor:default; }
  .focus-today-plan { grid-column:2; grid-row:1; display:flex; flex-direction:column; gap:18px; }
  .focus-today .today-next,.focus-today .today-family { padding:0 !important; min-height:0; background:transparent; border:0; border-radius:0; box-shadow:none; }
  .focus-today .today-next h2 { margin:10px 0 7px; font-size:27px; line-height:1.14; }
  .focus-today .today-next .supporting { margin:4px 0 12px; font-size:13px; }
  .focus-today .today-next .text-action { min-height:48px; margin:0; padding:0; }
  .focus-today .section-heading { margin-bottom:12px; }
  .focus-today .section-heading h2 { font-size:19px; }
  .focus-today .section-heading button { border:0; background:none; color:var(--daily-accent); min-height:48px; font-size:12px; }
  .focus-today .person-summary-list { gap:8px; }
  .focus-today .person-summary { min-height:58px; padding:8px 12px; }
  .focus-today .today-football { grid-column:1/-1; grid-row:2; padding:18px 0 0 !important; border:0; border-top:1px solid var(--daily-line); border-radius:0; background:transparent; }
  .focus-today .featured-fixtures { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
  .focus-today .compact-fixture { border:1px solid var(--daily-line); background:var(--daily-surface); }
  .focus-today .hero-metrics.focus-home-summary { grid-column:1/-1; grid-row:3; display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; }
  .focus-home-summary button { background:transparent; border:1px solid var(--daily-line); min-height:56px; }
  .focus-home-summary small { white-space:normal; overflow:visible; }
  .calendar-view { height:auto; min-height:100%; display:flex; flex-direction:column; padding:20px; gap:14px; border:0; }
  .calendar-toolbar { align-items:center; gap:12px; }
  .focus-calendar-title { margin:0 0 5px; font-size:28px; font-weight:700; letter-spacing:-.04em; }
  .calendar-context strong { font-size:12px; font-weight:500; color:var(--daily-muted); }
  .calendar-navigation { flex-wrap:wrap; }
  .calendar-navigation strong { margin-right:auto; }
  .family-planner-slot { overflow:visible; background:transparent; border:0; }
  .family-planner-grid.focus-week-picker { height:auto; min-width:0; gap:8px; grid-template-columns:repeat(7,minmax(0,1fr)); margin-bottom:20px; }
  .family-planner-grid.focus-week-picker.is-day { grid-template-columns:minmax(0,140px); }
  .focus-week-picker .family-planner-day { min-height:116px; padding:10px 8px; border-radius:14px; overflow:hidden; cursor:pointer; color:var(--daily-text); text-align:left; }
  .focus-week-picker .family-planner-day > header { display:flex; flex-direction:column; align-items:flex-start; border:0; padding:0; gap:4px; }
  .focus-week-picker .family-planner-day > header strong { font-size:25px; font-weight:650; }
  .focus-week-picker .family-planner-day > header span,.focus-week-picker .family-planner-day > header small { font-size:12px; }
  .focus-week-picker .family-planner-day.is-selected { border-color:var(--daily-accent); background:var(--daily-accent-soft); box-shadow:inset 0 0 0 1px var(--daily-accent); }
  .focus-calendar-dots { display:flex; gap:4px; min-height:12px; margin-top:8px; }
  .focus-calendar-dots i { width:5px; height:5px; border-radius:50%; background:var(--calendar-colour); }
  .focus-week-hint { display:block; font-size:12px; line-height:1.3; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .focus-week-hint small { display:block; font-size:12px; color:var(--daily-muted); margin-top:4px; }
  .focus-calendar-layout { display:grid; grid-template-columns:minmax(0,1.3fr) minmax(0,1fr); gap:24px; }
  .focus-calendar-agenda > header { display:flex; gap:12px; align-items:center; justify-content:space-between; margin-bottom:8px; }
  .focus-calendar-agenda h2 { font-size:20px; margin:0; letter-spacing:-.035em; }
  .focus-calendar-agenda > header small { color:var(--daily-muted); font-size:12px; }
  .focus-agenda-row { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:8px; align-items:center; padding:8px 0; border-bottom:1px solid var(--daily-line); }
  .focus-agenda-row .family-planner-event { min-height:86px; border:0; border-left:3px solid var(--calendar-colour); border-radius:0; background:transparent; grid-template-columns:auto 1fr; column-gap:12px; }
  .focus-agenda-row .planner-event-time { grid-row:1/3; font-size:13px; padding:4px 0; }
  .focus-agenda-row .family-planner-event strong { font-size:17px; grid-column:2; line-height:1.3; }
  .focus-agenda-row .family-planner-event small,.focus-agenda-row .planner-ready-state { grid-column:2; }
  .focus-plan-select { display:flex; gap:6px; align-items:center; min-height:48px; border:0; border-radius:10px; padding:8px; background:var(--daily-soft); color:var(--daily-muted); font-size:12px; }
  .focus-plan-select[aria-pressed="true"] { color:var(--daily-accent); background:var(--daily-accent-soft); }
  .focus-plan-select ha-icon { --mdc-icon-size:19px; }
  .focus-event-ready { background:var(--daily-soft); border-radius:20px; padding:22px; }
  .focus-prep-icon { --mdc-icon-size:28px; color:var(--daily-warning); margin-bottom:12px; }
  .focus-event-ready h2 { margin:8px 0; font-size:24px; letter-spacing:-.04em; }
  .focus-event-ready .supporting { font-size:12px; color:var(--daily-muted); margin:8px 0 16px; }
  .focus-checklist { display:flex; flex-direction:column; gap:6px; margin-top:12px; }
  .focus-ready-item { min-height:48px; width:100%; display:flex; gap:9px; align-items:center; padding:9px 10px; border:1px solid var(--daily-line); border-radius:10px; background:var(--daily-surface); color:var(--daily-text); text-align:left; font-size:13px; }
  .focus-ready-item ha-icon { --mdc-icon-size:19px; flex:0 0 19px; color:var(--daily-muted); }
  .focus-ready-item.is-complete { color:var(--daily-muted); }
  .focus-ready-item.is-complete span { text-decoration:line-through; }
  .focus-ready-person { margin-left:auto; color:var(--daily-muted); font-size:12px; }
  .focus-ready-count { font-size:12px; color:var(--daily-muted); }
  .focus-prep-links { display:flex; gap:12px; justify-content:space-between; margin-top:12px; }
  .focus-prep-links button,.focus-add-template { min-height:48px; padding:0; background:none; border:0; color:var(--daily-accent); font-size:12px; }
  .focus-prep-links ha-icon { --mdc-icon-size:16px; }
  .planner-date-select { min-width:48px; min-height:48px; border:0; border-radius:50%; background:none; color:var(--daily-text); }
  .planner-date-select[aria-pressed="true"] { background:var(--daily-accent); color:var(--daily-on-accent); }
  .planner-month-grid { height:auto; grid-auto-rows:minmax(110px,auto); margin-bottom:24px; }
  .planner-month-day { min-width:0; padding:4px; }
  .planner-month-day > div { overflow:visible; }
  .planner-month-day .family-planner-event { padding:5px; min-height:48px; }
  .focus-task-workspace { display:grid; grid-template-columns:minmax(0,1.4fr) minmax(0,1fr); gap:26px; margin-top:20px; }
  .focus-task-jobs,.focus-task-rewards { min-width:0; }
  .focus-task-rewards { padding:20px; border-radius:18px; background:var(--daily-soft); }
  .focus-task-rewards .family-summary-grid { display:flex; flex-direction:column; gap:10px; }
  .focus-task-rewards .family-summary-item { min-height:106px; padding:14px; background:var(--daily-surface); border-radius:14px; }
  .focus-task-jobs .chore-list { grid-template-columns:1fr !important; }
  .focus-task-jobs .chore-row.is-kid-card { min-height:76px; padding:14px; }
  .family-person.is-kid-mode .chore-heading { margin-top:0; }
  .focus-task-event { padding:16px 0; border-bottom:1px solid var(--daily-line); }
  .focus-task-event > header { display:flex; gap:10px; align-items:center; margin-bottom:12px; }
  .focus-task-event > header > ha-icon { color:var(--daily-warning); --mdc-icon-size:24px; }
  .focus-task-event header h3 { margin:0 0 4px; font-size:16px; }
  .focus-task-event small { font-size:12px; color:var(--daily-muted); }
  .focus-task-event > header > button { margin-left:auto; border:0; width:48px; height:48px; border-radius:50%; background:var(--daily-soft); color:var(--daily-text); }
  .focus-task-event .family-prep-list { gap:6px; }
  .focus-task-event .family-prep-item { min-height:48px; padding:8px; background:var(--daily-surface); }
  .focus-task-event .family-prep-item strong { font-size:13px; }
  .kid-mission { border-radius:18px; }
  .lighting-master,.heating-master,.energy-hero,.football-favourites-stage { background:var(--daily-strong); }
  .room-control-card { border-radius:18px; }
  .security-stage { background:#202329; }
  .security-stage .camera-stage-action b,.camera-idle button { background:#e4e9ed; color:#202329; }
  @media (max-width:850px), (orientation:portrait) {
    .hub-shell { display:grid; grid-template-columns:1fr; grid-template-rows:auto minmax(0,1fr); }
    .hub-navigation { flex-direction:row; overflow:auto; padding:6px 10px; border:0; border-bottom:1px solid var(--daily-line); gap:6px; }
    .hub-brand,.hub-nav-button { width:64px; min-height:50px; flex:1 0 64px; padding:6px; }
    .hub-brand span,.hub-nav-button span { display:block; font-size:11px; }
    .hub-content { padding:14px 18px; }
    .focus-music-dock.today-music { grid-template-columns:40px minmax(60px,1fr) auto; padding:8px 14px !important; gap:8px; }
    .focus-dock-output,.focus-dock-volume { display:none; }
    .today-grid.focus-today,.today-grid.focus-today:has(.today-football) { display:flex; flex-direction:column; }
    .focus-home-card,.focus-today-plan,.focus-today .today-football,.focus-home-summary { width:100%; }
    .hero-panel.today-hero.focus-home-card { min-height:380px; }
    .focus-today-plan { gap:24px; }
    .focus-calendar-layout,.focus-task-workspace { grid-template-columns:1fr; }
    .family-planner-grid.focus-week-picker { min-width:0; gap:4px; }
    .focus-week-picker .family-planner-day { min-height:102px; padding:8px 5px; }
    .focus-week-hint { display:none; }
    .calendar-toolbar-actions { display:flex; flex-wrap:wrap; }
    .calendar-modes { display:flex; flex-wrap:wrap; }
    .focus-today .hero-metrics.focus-home-summary { grid-template-columns:repeat(2,minmax(0,1fr)); }
    .family-dashboard,.family-kid-stage { height:auto; overflow:visible; }
    .calendar-view { padding:16px; }
    .home-surface,.home-overview { height:auto; grid-template-rows:auto auto; }
    .rooms-layout { height:auto; display:flex; flex-direction:column; }
    .floorplan-canvas { min-height:360px; }
    .room-detail.home-drawer { overflow:visible; }
  }
  @media (max-width:480px) {
    .focus-app-brand { padding:0 14px; }
    .hub-content { padding:10px 12px; grid-template-rows:auto minmax(0,1fr); gap:14px; }
    .hub-topbar { gap:8px; }
    .hub-header-actions { justify-content:flex-start; gap:8px; }
    .hub-topbar-time { font-size:19px; min-width:50px; }
    .hub-weather-pill { font-size:12px; padding:8px; }
    .focus-music-dock .artwork { width:36px; height:36px; }
    .focus-dock-action { width:36px; }
    .focus-dock-playback { gap:0; }
    .focus-music-dock.today-music { padding:8px 10px !important; gap:5px; grid-template-columns:36px minmax(50px,1fr) auto; }
    .hero-panel.today-hero.focus-home-card { min-height:330px; padding:20px; }
    .focus-home-card .today-hero-copy h2 { font-size:30px; }
    .focus-home-controls { left:12px; right:12px; bottom:12px; gap:6px; }
    .focus-home-controls button { padding:10px 8px; gap:6px; }
    .focus-home-controls button > ha-icon { --mdc-icon-size:20px; }
    .focus-home-controls strong { font-size:13px; }
    .focus-today .featured-fixtures { grid-template-columns:1fr; }
    .focus-week-picker .family-planner-day { padding:6px 2px; min-height:88px; text-align:center; }
    .focus-week-picker .family-planner-day > header { align-items:center; }
    .focus-week-picker .family-planner-day > header span { max-width:100%; overflow:hidden; font-size:10px; }
    .focus-week-picker .family-planner-day > header small { display:none; }
    .focus-week-picker .family-planner-day > header strong { font-size:21px; }
    .focus-calendar-dots { justify-content:center; gap:2px; }
    .focus-agenda-row { grid-template-columns:1fr; }
    .focus-plan-select { justify-self:start; }
    .planner-month-grid { grid-auto-rows:minmax(58px,auto); gap:2px; }
    .planner-month-day > div { display:none; }
    .planner-month-day { padding:0; min-height:58px; }
    .planner-date-select { min-width:28px; min-height:48px; }
    .calendar-view { padding:12px; }
    .home-surface,.home-section,.home-overview,.floorplan-panel { min-width:0; width:100%; max-width:100%; }
    .home-surface,.home-overview,.football-experience { grid-template-columns:minmax(0,1fr); }
    .football-favourites-stage,.football-main { min-width:0; max-width:100%; }
    .football-hero-heading > div { min-width:0; }
    .football-hero-heading h2 { font-size:26px; overflow-wrap:anywhere; }
    .favourite-fixture-summary { grid-template-columns:minmax(0,1fr) 22px 54px; }
    .favourite-result { min-width:0; }
    .football-toolbar { flex-wrap:wrap; }
    .matchweek-controls { max-width:100%; flex-wrap:wrap; }
    .home-toolbar > div { min-width:0; max-width:100%; }
    .home-segments { width:100%; max-width:100%; overflow-x:auto; }
    .home-summary-links,.home-summary-links[data-summary-count] { min-width:0; max-width:100%; grid-template-columns:1fr; }
    .floorplan-heading { flex-direction:column; align-items:flex-start; }
    .floorplan-heading .segments { width:100%; flex-wrap:wrap; }
    .focus-event-ready { padding:16px; }
  }
`;
