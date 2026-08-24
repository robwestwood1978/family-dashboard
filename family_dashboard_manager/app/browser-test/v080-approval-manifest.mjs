export const APPROVAL_PROJECTS = Object.freeze([
  "approval-chromium-1024x768",
  "approval-chromium-1112x834",
  "approval-webkit-1024x768",
  "approval-webkit-1112x834"
]);

export const APPROVAL_VIEW_NAMES = Object.freeze([
  "today",
  "home-rooms",
  "home-heating-six",
  "calendar-controls",
  "family-location-off",
  "music-five-room",
  "security-idle",
  "security-buffering",
  "security-live",
  "security-stopping",
  "security-retry",
  "security-garage-confirmation",
  "football-live",
  "football-cached",
  "football-stale"
]);

export const APPROVAL_ZOOM_PROJECTS = Object.freeze([
  "approval-chromium-1112x834",
  "approval-webkit-1112x834"
]);

export const APPROVAL_ZOOM_VIEW_NAMES = Object.freeze([
  "today",
  "home-heating-six",
  "family-location-off",
  "security-garage-confirmation",
  "football-live"
]);

export function expectedApprovalScreens() {
  return APPROVAL_PROJECTS.flatMap((project) => [
    ...APPROVAL_VIEW_NAMES.map((name) => ({ project, name: `v080-${name}.png`, kind: "nominal" })),
    ...(APPROVAL_ZOOM_PROJECTS.includes(project)
      ? APPROVAL_ZOOM_VIEW_NAMES.map((name) => ({ project, name: `v080-zoom-${name}.png`, kind: "zoom-200" }))
      : [])
  ]);
}
