import { argon2id } from "hash-wasm";

self.onmessage = async (e: MessageEvent) => {
  const { password, salt, parallelism, iterations, memorySize, hashLength } = e.data;
  
  try {
    const derivedKeyBytes = await argon2id({
      password,
      salt,
      parallelism: parallelism || 4,
      iterations: iterations || 3,
      memorySize: memorySize || 64 * 1024,
      hashLength: hashLength || 32,
      outputType: "binary",
    });
    
    self.postMessage({ success: true, derivedKeyBytes }, { transfer: [derivedKeyBytes.buffer] });
  } catch (error) {
    self.postMessage({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
};
