# PowerShell script to start the Perky Pugs Bot
# This avoids the batch job prompt by running Node.js directly

Write-Host "Starting Perky Pugs Bot..." -ForegroundColor Green
node src/server.js
