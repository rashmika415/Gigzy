// Firebase's React Native entry-point packages in this project do not ship their
// declaration re-exports. Point TypeScript at the declarations from the
// underlying Firebase packages used by those entry points.
declare module 'firebase/app' {
  export * from '@firebase/app';
}

declare module 'firebase/auth' {
  export * from '@firebase/auth';
}

declare module 'firebase/firestore' {
  export * from '@firebase/firestore';
}

declare module 'firebase/storage' {
  export * from '@firebase/storage';
}
