export default { testDir: 'tests', timeout: 30000, workers: 1, retries: process.env.CI ? 2 : 0, use: { viewport: { width: 1360, height: 860 } }, reporter: [['list']] };
