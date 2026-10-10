// Node's TypeScript runner leaves extensionless relative imports untouched.
// Vite resolves them normally; this tiny loader is only for resource tests.
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts") &&
      !/\.[cm]?[jt]s$/.test(specifier)) {
    return nextResolve(`${specifier}.ts`, context);
  }
  return nextResolve(specifier, context);
}
