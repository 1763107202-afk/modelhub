const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests',
  timeout: 25000,
  expect: { timeout: 6000 },
  retries: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:8765',
    browserName: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1920, height: 1080 }
  },
  webServer: {
    command: 'python3 -m http.server 8765 --bind 127.0.0.1',
    url: 'http://127.0.0.1:8765/competition-live/index.html?demo=1',
    timeout: 20000,
    reuseExistingServer: false
  },
  outputDir: './test-results'
});
