#!/usr/bin/env python3
"""Run on this assignment's Ubuntu EC2 via SSH. Read only, no sudo, no secrets in output."""
import datetime
import json
import os
import pathlib
import platform
import pwd
import stat
import subprocess
import sys
import urllib.request


def command(args):
    try:
        return subprocess.run(args, check=True, capture_output=True, text=True, timeout=35).stdout.strip()
    except (subprocess.SubprocessError, OSError):
        raise RuntimeError("CommandFailed: " + args[0]) from None


def main():
    report = {"version": "1.0.0", "checkedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(), "checks": []}

    def check(check_id, ok, actual):
        report["checks"].append({"id": check_id, "status": "PASS" if ok else "FAIL", "actual": actual})

    # IMDS token stays in memory; the identity document contains no application secrets.
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    token = opener.open(urllib.request.Request("http://169.254.169.254/latest/api/token", method="PUT", headers={"X-aws-ec2-metadata-token-ttl-seconds": "60"}), timeout=3).read().decode()
    ident = json.load(opener.open(urllib.request.Request("http://169.254.169.254/latest/dynamic/instance-identity/document", headers={"X-aws-ec2-metadata-token": token}), timeout=3))
    report["instanceId"] = ident["instanceId"]
    report["region"] = ident["region"]
    os_release = pathlib.Path("/etc/os-release").read_text()
    check("host.os", 'ID=ubuntu' in os_release and 'VERSION_ID="24.04"' in os_release and platform.machine() == "aarch64", "Ubuntu 24.04 / " + platform.machine())
    user = pwd.getpwuid(os.getuid()).pw_name
    check("host.user", user == "deployer" and "docker" in command(["id", "-nG"]).split(), "deployer 與 docker 群組符合=" + str(user == "deployer"))
    ids = command(["docker", "ps", "-aq", "--filter", "label=com.docker.compose.project=aws-livefit", "--filter", "label=com.docker.compose.service=backend"]).splitlines()
    check("host.single", len(ids) == 1, "本作業 backend 容器數=" + str(len(ids)))
    if len(ids) != 1:
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 1
    container = json.loads(command(["docker", "inspect", ids[0]]))[0]
    # Docker inspect contains Env; allowlist observations below and never print the raw object.
    check("host.health", container.get("State", {}).get("Running") is True and container.get("State", {}).get("Health", {}).get("Status") == "healthy", "Health=" + str(container.get("State", {}).get("Health", {}).get("Status")))
    ports = container.get("HostConfig", {}).get("PortBindings", {})
    check("host.binding", ports == {"8080/tcp": [{"HostIp": "127.0.0.1", "HostPort": "8080"}]}, "僅 127.0.0.1:8080=" + str(ports == {"8080/tcp": [{"HostIp": "127.0.0.1", "HostPort": "8080"}]}))
    check("host.restart", container.get("HostConfig", {}).get("RestartPolicy", {}).get("Name") == "unless-stopped", "RestartPolicy=" + str(container.get("HostConfig", {}).get("RestartPolicy", {}).get("Name")))
    check("host.container-user", container.get("Config", {}).get("User") == "node", "容器以 node 執行=" + str(container.get("Config", {}).get("User") == "node"))
    image = json.loads(command(["docker", "image", "inspect", container["Image"]]))[0]
    report["imageDigests"] = [x.split("@", 1)[1] for x in image.get("RepoDigests", []) if "@sha256:" in x]
    check("host.image", image.get("Architecture") == "arm64" and bool(report["imageDigests"]), "映像架構=" + str(image.get("Architecture")) + "；有 Registry digest=" + str(bool(report["imageDigests"])))
    env_file = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "/home/deployer/livefit/deploy/.env.aws")
    try:
        mode = stat.S_IMODE(env_file.stat().st_mode)
        check("host.env-file", mode == 0o600 and env_file.stat().st_uid == os.getuid(), "環境檔 mode=" + oct(mode) + "；不讀取檔案內容。")
    except OSError:
        check("host.env-file", False, "找不到環境檔；若路徑不同，請傳入自己的路徑。")
    js = r'''
const { Client } = require('pg')
const { dataSource } = require('./db/data-source')
async function main () {
  const o = dataSource.options
  const result = {
    dbHost: o.host, bucket: process.env.S3_BUCKET, region: process.env.AWS_REGION,
    noStaticKeys: !['AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','AWS_SESSION_TOKEN'].some(k => process.env[k]),
    syncDisabled: o.synchronize === false, verifyTLS: o.ssl?.rejectUnauthorized === true && Boolean(o.ssl?.ca)
  }
  const db = new Client({ host: o.host, port: o.port, user: o.username, password: o.password, database: o.database, ssl: o.ssl, connectionTimeoutMillis: 8000, query_timeout: 8000 })
  try {
    await db.connect()
    await db.query('BEGIN READ ONLY')
    const r = await db.query('SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()')
    result.sqlTLS = r.rows.length === 1 && r.rows[0].ssl === true
    await db.query('ROLLBACK')
  } finally { await db.end() }
  console.log(JSON.stringify(result))
}
main().catch(() => { console.log(JSON.stringify({ error: 'DBConnectionCheckFailed' })); process.exitCode = 1 })
'''
    try:
        runtime = json.loads(command(["docker", "exec", "-w", "/app", ids[0], "node", "-e", js]))
        report["runtime"] = runtime
        check("host.runtime", runtime.get("noStaticKeys") is True and runtime.get("syncDisabled") is True and runtime.get("verifyTLS") is True and runtime.get("sqlTLS") is True, "無固定 AWS keys=" + str(runtime.get("noStaticKeys")) + "；synchronize=false=" + str(runtime.get("syncDisabled")) + "；DB 憑證驗證=" + str(runtime.get("verifyTLS")) + "；SQL TLS=" + str(runtime.get("sqlTLS")))
    except RuntimeError:
        report["checks"].append({"id": "host.runtime", "status": "BLOCKED", "actual": "未取得容器內 DB／環境證據；請看自己的日誌，不提交環境變數值。"})
    check("host.nginx", command(["systemctl", "is-active", "nginx"]) == "active", "Nginx active")
    try:
        timer = command(["systemctl", "is-active", "certbot.timer"])
    except RuntimeError:
        timer = "inactive or unavailable"
    check("host.certbot-timer", timer == "active", "Certbot timer=" + timer + "；未執行 renew dry-run。")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 1 if any(x["status"] == "FAIL" for x in report["checks"]) else 2 if any(x["status"] == "BLOCKED" for x in report["checks"]) else 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        # Never expose environment, SSH output, SQL errors or IMDS responses.
        print(json.dumps({"version": "1.0.0", "error": "HostCheckBlocked", "hint": "請確認正在自己的 Ubuntu EC2 以 deployer 執行，並有 Docker 權限與 IMDSv2。"}, ensure_ascii=False))
        sys.exit(2)
