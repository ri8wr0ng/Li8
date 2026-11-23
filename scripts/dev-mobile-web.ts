import process from "node:process";

const backend = Bun.spawn(["bun", "--filter", "@inkmark/backend", "dev"], {
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
});
const mobile = Bun.spawn(["bun", "--filter", "mobile", "web"], {
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
});

let stopping = false;
function stopChildren() {
  if (stopping) return;
  stopping = true;
  backend.kill();
  mobile.kill();
}

process.on("SIGINT", stopChildren);
process.on("SIGTERM", stopChildren);

const result = await Promise.race([
  backend.exited.then((code) => ({ name: "Convex", code })),
  mobile.exited.then((code) => ({ name: "Expo web", code })),
]);
console.error(`${result.name} exited with code ${result.code}; stopping the other process.`);
stopChildren();
await Promise.all([backend.exited, mobile.exited]);
process.exitCode = result.code;
