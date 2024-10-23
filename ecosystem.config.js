module.exports = {
  apps: [{
    name: 'scraper-api',
    script: 'dist/index.js',
    instances: 1,
    exec_mode: 'cluster',
    max_memory_restart: '900M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
