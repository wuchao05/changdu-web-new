module.exports = {
  apps: [
    {
      name: 'changdu-web',
      script: 'npm',
      args: 'start',
      cwd: './',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        // Studio 数据目录（推荐使用项目外持久化路径）
        STUDIO_DATA_DIR: '/data/changdu-web/studio',
        // 常读 a_bogus 逆向目录（必填）
        // 目录中至少要有 env.js 和 bdms.js
        // 不要放在当前项目仓库内，避免被 type:module 作用域影响
        CHANGDU_REVERSE_DIR: '/data/changdu-web/reverse-bogus',
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
}
