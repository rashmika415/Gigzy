// Extend app.json while keeping native identifiers stable.
module.exports = ({ config }) => ({
  ...config,
  android: { ...config.android, package: config.android?.package ?? 'com.isuru.gigzy' },
});
