export async function resolve(specifier, context, defaultResolve) {
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !specifier.match(/\.[a-z]+$/i)) {
    try {
      return await defaultResolve(`${specifier}.js`, context, defaultResolve);
    } catch {
      // fall back
    }
  }
  return defaultResolve(specifier, context, defaultResolve);
}
