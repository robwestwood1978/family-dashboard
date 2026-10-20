import { fileURLToPath } from "node:url";
import { createIntegrationStoreClass } from "./managed-integration-store.mjs";

export const MANAGED_FILES = Object.freeze([
  "README.md", "__init__.py", "config_flow.py", "model.py", "manifest.json", "strings.json", "translations/en.json"
]);
export const HomeworkIntegrationStore = createIntegrationStoreClass({
  domain:"family_dashboard_homework", label:"Homework", managedFiles:MANAGED_FILES,
  defaultBundleDir:fileURLToPath(new URL("../integrations/family_dashboard_homework/",import.meta.url)),
  defaultTargetDir:"/config/custom_components/family_dashboard_homework"
});
