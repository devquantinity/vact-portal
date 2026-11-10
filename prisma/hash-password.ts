import "./load-env";
import { hash } from "@node-rs/argon2";

/**
 * Prints an argon2id hash of SEED_PASSWORD (from .env) to use as SEED_PASSWORD_HASH on a host whose
 * config should not hold the demo password itself. Same parameters as the seed and the login code.
 */
async function main() {
  const password = process.env.SEED_PASSWORD;
  if (!password) {
    console.error("SEED_PASSWORD is not set in .env");
    process.exit(1);
  }
  console.log(await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
