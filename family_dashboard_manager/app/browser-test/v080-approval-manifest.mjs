export const APPROVAL_PROJECTS = Object.freeze([
  "approval-chromium-1024x768",
  "approval-chromium-1112x834",
  "approval-chromium-1440x900",
  "approval-webkit-1024x768",
  "approval-webkit-1112x834",
  "approval-webkit-1440x900"
]);

export const APPROVAL_VIEW_NAMES = Object.freeze([
  "today",
  "home-rooms",
  "home-lights",
  "home-heating",
  "home-covers",
  "home-cleaning",
  "calendar-smoke",
  "family-smoke",
  "music-smoke",
  "security-idle",
  "security-waking",
  "security-buffering",
  "security-confirmation",
  "security-alert-unavailable",
  "football-live",
  "football-cached",
  "football-stale"
]);

export const APPROVAL_ZOOM_PROJECT = "approval-chromium-1112x834";

export const APPROVAL_ZOOM_VIEW_NAMES = Object.freeze([
  "today",
  "home-rooms",
  "security-alert-unavailable",
  "football-live"
]);

export function expectedApprovalScreens() {
  return APPROVAL_PROJECTS.flatMap((project) => [
    ...APPROVAL_VIEW_NAMES.map((name) => ({ project, name: `v080-${name}.png`, kind: "nominal" })),
    ...(project === APPROVAL_ZOOM_PROJECT
      ? APPROVAL_ZOOM_VIEW_NAMES.map((name) => ({ project, name: `v080-zoom-${name}.png`, kind: "zoom-200" }))
      : [])
  ]);
}
