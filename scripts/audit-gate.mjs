import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const exceptions = JSON.parse(readFileSync(resolve("security/audit-exceptions.json"), "utf8"));
const today = new Date().toISOString().slice(0, 10);

for (const exception of exceptions) {
  if (!exception.advisory || !exception.package || !exception.reviewBy || !exception.reason) {
    console.error("Invalid audit exception: each entry needs advisory, package, reviewBy, and reason.");
    process.exit(2);
  }
  if (exception.reviewBy < today) {
    console.error(`Audit exception for ${exception.advisory} expired on ${exception.reviewBy}.`);
    process.exit(2);
  }
}

const audit = spawnSync(
  process.platform === "win32" ? "cmd.exe" : "npm",
  process.platform === "win32" ? ["/d", "/s", "/c", "npm audit --json"] : ["audit", "--json"],
  {
  encoding: "utf8",
  maxBuffer: 10 * 1024 * 1024,
  },
);

if (audit.error) {
  console.error("Could not run npm audit:", audit.error.message);
  process.exit(2);
}

let report;
try {
  report = JSON.parse(audit.stdout || audit.stderr);
} catch {
  console.error("npm audit did not return a valid JSON report.");
  if (audit.stdout) console.error(audit.stdout);
  if (audit.stderr) console.error(audit.stderr);
  process.exit(2);
}

if (report.error || report.message) {
  console.error("npm audit failed:", report.message || report.error.summary || report.error.detail);
  process.exit(2);
}

if (!report.vulnerabilities || typeof report.vulnerabilities !== "object") {
  console.error("npm audit report is missing its vulnerabilities map.");
  process.exit(2);
}

const allowedAdvisories = new Set(exceptions.map((exception) => new URL(exception.advisory).href));
const exceptedPackages = new Set();
let changed = true;

// Propagate only when every audit path is explained by the exact exception.
while (changed) {
  changed = false;
  for (const [name, vulnerability] of Object.entries(report.vulnerabilities)) {
    if (exceptedPackages.has(name)) continue;
    const via = Array.isArray(vulnerability.via) ? vulnerability.via : [];
    const allViaExcepted = via.length > 0 && via.every((item) => {
      if (typeof item === "string") return exceptedPackages.has(item);
      if (!item || typeof item !== "object" || !allowedAdvisories.has(item.url)) return false;
      return exceptions.some((exception) => exception.package === name &&
        new URL(exception.advisory).href === item.url);
    });
    if (allViaExcepted) {
      exceptedPackages.add(name);
      changed = true;
    }
  }
}

for (const exception of exceptions) {
  const url = new URL(exception.advisory).href;
  const affected = [...exceptedPackages].filter((name) =>
    report.vulnerabilities[name]?.via?.some((item) => typeof item === "object" && item.url === url));
  if (affected.length > 0) {
    console.warn(`Temporarily excepting ${exception.advisory} (${affected.join(", ")}); review by ${exception.reviewBy}. ${exception.reason}`);
  }
}

const blocking = Object.entries(report.vulnerabilities).filter(([name, vulnerability]) =>
  !exceptedPackages.has(name) && ["high", "critical"].includes(String(vulnerability.severity).toLowerCase()));
if (blocking.length > 0) {
  console.error("High or critical vulnerabilities remain:");
  for (const [name, vulnerability] of blocking) {
    console.error(`- ${name}: ${vulnerability.severity} (${vulnerability.range})`);
  }
  process.exit(1);
}

console.log("No unexcepted high or critical vulnerabilities found.");
