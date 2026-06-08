import { argon2id } from 'hash-wasm';

async function testArgon2() {
  const password = "Passw0rd!123";
  const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
  const derived = await argon2id({
    password,
    salt,
    parallelism: 4,
    iterations: 3,
    memorySize: 64 * 1024,
    hashLength: 32,
    outputType: "binary",
  });
  console.log("JS Derived:", Buffer.from(derived).toString('hex'));
}
testArgon2();
