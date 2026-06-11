// Polyfills para Firebase v12 + Hermes
// Este archivo debe importarse ANTES que cualquier módulo de Firebase

if (typeof global.FormData === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  global.FormData = require('react-native/Libraries/Network/FormData').default;
}

if (typeof global.Blob === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  global.Blob = require('react-native/Libraries/Blob/Blob').default;
}

if (typeof global.FileReader === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  global.FileReader = require('react-native/Libraries/Blob/FileReader').default;
}
