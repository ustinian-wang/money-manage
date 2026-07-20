module.exports = {
  apps: [
    {
      name: 'money-manage',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3001',
      cwd: __dirname,
      interpreter: 'node',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      exp_backoff_restart_delay: 100,
      restart_delay: 1000,
      max_restarts: 20,
      min_uptime: '10s',
      kill_timeout: 5000,
      time: true,
      merge_logs: true,
      out_file: './logs/money-manage-out.log',
      error_file: './logs/money-manage-error.log'
    }
  ]
};
