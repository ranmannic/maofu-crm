/** PM2 进程配置 — 复制到服务器后按 DEPLOY.md 调整路径 */
module.exports = {
  apps: [
    {
      name: "maofu-crm",
      cwd: "/opt/maofu-crm",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
