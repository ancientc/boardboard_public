/**
 * Stops a previous Cloudflare preview (wrangler/workerd) so OpenNext can
 * delete and recreate `.open-next` on the next build.
 */
import { execSync } from "node:child_process";
import { platform } from "node:os";

const PREVIEW_PORT = 8787;

function killPidsOnPort(port) {
  if (platform() === "win32") {
    let out = "";
    try {
      out = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8" });
    } catch {
      return;
    }
    const pids = new Set();
    for (const line of out.split("\n")) {
      const match = line.trim().match(/\s+(\d+)\s*$/);
      if (match) pids.add(match[1]);
    }
    for (const pid of pids) {
      if (!pid || pid === "0") continue;
      try {
        execSync(`taskkill /PID ${pid} /F /T`, { stdio: "ignore" });
      } catch {
        // Process may already have exited.
      }
    }
    return;
  }

  try {
    execSync(`lsof -ti:${port} | xargs -r kill -9`, {
      stdio: "ignore",
      shell: true,
    });
  } catch {
    // Nothing listening on the port.
  }
}

function killWorkerdOnWindows() {
  if (platform() !== "win32") return;
  try {
    execSync("taskkill /F /IM workerd.exe", { stdio: "ignore" });
  } catch {
    // No workerd processes.
  }
}

killPidsOnPort(PREVIEW_PORT);
killWorkerdOnWindows();

// Give Windows a moment to release handles on `.open-next` after workerd exits.
if (platform() === "win32") {
  await new Promise((resolve) => setTimeout(resolve, 1500));
}
