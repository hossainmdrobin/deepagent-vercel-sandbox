import { config } from "dotenv";
import { Sandbox } from "@vercel/sandbox";

config({ path: ".env.local" });

async function main() {
  const sandbox = await Sandbox.create();

  try {
    const result = await sandbox.runCommand("node", [
      "-e",
      'console.log("Hello from an isolated Vercel Sandbox!")',
    ]);

    console.log(await result.stdout());

    if (result.exitCode !== 0) {
      throw new Error(`Sandbox command failed: ${result.exitCode}`);
    }
  } finally {
    await sandbox.stop();
  }
}

main().catch(console.error);