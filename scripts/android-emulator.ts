import { homedir } from "node:os";
import { join } from "node:path";

function findSdk(): string | null {
  const configured = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (configured) return configured;
  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA;
    return localAppData ? join(localAppData, "Android", "Sdk") : null;
  }
  if (process.platform === "darwin") return join(homedir(), "Library", "Android", "sdk");
  return join(homedir(), "Android", "Sdk");
}

const sdk = findSdk();
if (!sdk) {
  console.error("Android SDK not found. Set ANDROID_HOME or ANDROID_SDK_ROOT.");
  process.exit(1);
}

const executable = join(
  sdk,
  "emulator",
  process.platform === "win32" ? "emulator.exe" : "emulator",
);
if (!(await Bun.file(executable).exists())) {
  console.error(`Android emulator executable not found: ${executable}`);
  process.exit(1);
}

const listing = Bun.spawn([executable, "-list-avds"], {
  stdout: "pipe",
  stderr: "pipe",
});
const [listingCode, avdOutput, listingError] = await Promise.all([
  listing.exited,
  new Response(listing.stdout).text(),
  new Response(listing.stderr).text(),
]);
if (listingCode !== 0) {
  console.error(`Could not list Android AVDs: ${listingError.trim()}`);
  process.exit(listingCode);
}

const avds = avdOutput
  .split(/\r?\n/)
  .map((name) => name.trim())
  .filter(Boolean);
if (avds.length === 0) {
  console.error("No Android virtual devices found. Create an AVD in Android Studio first.");
  process.exit(1);
}

const args = process.argv.slice(2);
const requestedAvd = args[0] || process.env.ANDROID_AVD;
const avd = requestedAvd || avds[0];
if (!avd) {
  console.error("No Android virtual device name was available.");
  process.exit(1);
}
if (!avds.includes(avd)) {
  console.error(`AVD '${avd}' was not found. Available AVDs: ${avds.join(", ")}`);
  process.exit(1);
}

const extraArgs = requestedAvd ? args.slice(1) : args;
const emulator = Bun.spawn(
  [executable, "-avd", avd, "-gpu", "host", "-no-boot-anim", ...extraArgs],
  {
    detached: true,
    stdin: "ignore",
    stdout: "ignore",
    stderr: "ignore",
  },
);
emulator.unref();
console.log(`Launched Android emulator '${avd}' with host GPU rendering (PID ${emulator.pid}).`);
