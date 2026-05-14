// Run with: node scripts/reset-admin-hash.js
const readline = require("readline");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function askHidden(prompt) {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    let input = "";
    process.stdin.on("data", function handler(char) {
      char = char.toString();
      if (char === "\r" || char === "\n") {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener("data", handler);
        process.stdout.write("\n");
        resolve(input);
      } else if (char === "") {
        process.stdout.write("\nCancelled.\n");
        process.exit(0);
      } else if (char === "") {
        if (input.length > 0) {
          input = input.slice(0, -1);
          process.stdout.clearLine(0);
          process.stdout.cursorTo(0);
          process.stdout.write(prompt + "*".repeat(input.length));
        }
      } else {
        input += char;
        process.stdout.write("*");
      }
    });
  });
}

async function main() {
  console.log("=== Admin password hash reset ===\n");

  const password = await askHidden("New password: ");
  const confirm = await askHidden("Confirm password: ");
  rl.close();

  if (password !== confirm) {
    console.error("Passwords do not match.");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  console.log("Generating hash…");
  const hash = await bcrypt.hash(password, 10);

  let env = fs.readFileSync(envPath, "utf8");
  if (/^ADMIN_PASSWORD_HASH=.*/m.test(env)) {
    env = env.replace(/^ADMIN_PASSWORD_HASH=.*/m, `ADMIN_PASSWORD_HASH=${hash}`);
  } else {
    env += `\nADMIN_PASSWORD_HASH=${hash}\n`;
  }
  fs.writeFileSync(envPath, env, "utf8");

  console.log("Done! .env updated. Restart next dev to apply.");
}

main().catch((e) => { console.error(e); process.exit(1); });
