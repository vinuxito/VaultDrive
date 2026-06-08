# Step 1: Staging Server Deployment & Vhost Setup

This step details the deployment of the verified codebase to the staging web server environment, ensuring correct file permissions, service ownership, and systemd service configurations.

---

## 🎯 Goal
Deploy the `uappgenerator` and both drive codebases to `/lamp/www/` staging, configure folder permissions so the dynamic generator can write assets, and verify that the systemd services start cleanly.

---

## 🏗️ Deployment Action Steps

### 1. Codebase Sync & Directory Setup
- Sync target files to the staging directories:
  - Upstream Generator: `/lamp/www/uappgenerator`
  - QuantiX Drive: `/lamp/www/QuantiX-Drive`
  - ABRN Drive: `/lamp/www/ABRN-Drive`
- Create the deployments subdirectory if missing:
  ```bash
  mkdir -p /lamp/www/uappgenerator/storage/deployments
  ```

### 2. Permissions Hardening (Couch Approved VFS Access)
- The PHP server process (`daemon`) must be able to write generated apps, compile templates, and backup snapshots.
- Set correct group and folder permissions:
  ```bash
  sudo chown -R vinuxito:daemon /lamp/www/uappgenerator
  sudo chmod -R 775 /lamp/www/uappgenerator
  sudo chmod -R 777 /lamp/www/uappgenerator/storage
  ```

### 3. Service Configuration & Restarts
- Ensure both Drive Go services are registered under systemd:
  - `/etc/systemd/system/quantixdrive.service` (serving port `8090`)
  - `/etc/systemd/system/abrndrive.service` (downstream override, serving port `8091`)
- Execute clean service restarts:
  ```bash
  sudo systemctl daemon-reload
  sudo systemctl restart quantixdrive
  sudo systemctl restart abrndrive
  ```

---

## 💻 Environment Variables Configuration

Copy `.env.example` to `.env` in all staging directories and configure key credentials (without hardcoding passwords in repository history):
- For `uappgenerator`:
  ```ini
  DB_HOST="localhost"
  DB_NAME="uappgenerator"
  DB_USER="uappgen"
  DB_PASS="staging-db-pass"
  DB_SOCKET="/lamp/mysql/mysql.sock"
  ```
- Guard variables using permissions:
  ```bash
  chmod 600 /lamp/www/uappgenerator/.env
  ```

---

## 🧪 Verification Plan
- Run local health checking probes:
  ```bash
  curl -i http://localhost:8090/quantix/api/healthz
  curl -i https://uappgenerator.filemonprime.net/health
  ```
- Assert that both respond with `HTTP 200 OK`.
