import { BrowserPod } from "@leaningtech/browserpod";
import { copyFile } from "./utils.js";

export const pod = await BrowserPod.boot({
  apiKey: import.meta.env.VITE_BP_APIKEY,
});

export const terminal = await pod.createDefaultTerminal(
  document.querySelector("#console"),
);

const _portals = {};
pod.onPortal(({ url, port }) => {
  _portals[port] = url;
  console.log(`[BrowserPod] Portal live → ${url} (port ${port})`);
});
export function getPortalUrl(port) {
  return _portals[port] ?? null;
}

const homePath = "/home/user";
const projectPath = `${homePath}/project`;

await pod.createDirectory(projectPath);
await copyFile(pod, "project/main.js", homePath);
await copyFile(pod, "project/package.json", homePath);

await pod.run("npm", ["install"], { echo: true, terminal, cwd: projectPath });
await pod.run("node", ["main.js"], { echo: true, terminal, cwd: projectPath });

console.log("[BrowserPod] Pod initialised ✓");
