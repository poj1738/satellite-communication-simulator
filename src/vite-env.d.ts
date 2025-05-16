/// <reference types="vite/client" />

// Allow importing CSS files
declare module '*.css' {
  const css: { [key: string]: string };
  export default css;
}

// Enable Web Worker imports
declare module '*?worker' {
  const workerConstructor: {
    new (): Worker;
  };
  export default workerConstructor;
}

interface Window {
  // Add any window-specific interfaces here
}

// WebWorker global scope
declare const self: DedicatedWorkerGlobalScope;
