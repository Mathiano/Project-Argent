// Vite resolves binary asset imports to a hashed URL string at build/dev time.
// Ambient declarations so the TS project build accepts those imports.
declare module '*.woff2' {
  const url: string;
  export default url;
}
declare module '*.woff' {
  const url: string;
  export default url;
}
declare module '*.ttf' {
  const url: string;
  export default url;
}
