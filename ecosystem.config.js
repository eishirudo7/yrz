```javascript
module.exports = {
  apps: [
    {
      name: "omniyrz-web",
      script: "npm",
      args: "run start:prod",
      instances: "max",
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        PORT: 10000
      }
    },
    {
      name: "omniyrz-worker",
      script: "npm",
      args: "run worker:webhook",
      instances: 1, // Only 1 instance needed for BullMQ worker usually
      env: {
        NODE_ENV: "production"
      }
    }
  ]
}
```
