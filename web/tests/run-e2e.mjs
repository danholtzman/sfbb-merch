import { spawnSync } from "node:child_process";
// Historical orders cannot be deleted through production APIs. Run order API
// acceptance in a fresh disposable database rather than weaken deletion guards
// or make earlier season tests depend on file execution order.
const args = process.argv.slice(2);
const passes = args.length ? [args] : [["--grep-invert", "@orders-api|@member-ui|@admin-orders"], ["--grep", "@orders-api"], ["--grep", "@member-ui"], ["--grep", "@admin-orders"]];
for (const pass of passes) {
 const result = spawnSync(process.execPath, ["node_modules/@playwright/test/cli.js", "test", ...pass], { stdio: "inherit" });
 if (result.status !== 0) process.exit(result.status ?? 1);
}
