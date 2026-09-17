// Test identity is explicit; never read the deployed application environment.
export function getProductName(): string {
  return process.env.VITE_PRODUCT_NAME || "ABRN Drive";
}
