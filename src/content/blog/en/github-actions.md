---
title: "From manual to automated deployment: my first pipeline with GitHub Actions"
description: "How I automated my website deployment using GitHub Actions, rsync, and Tailscale, including the problems I solved along the way."
date: 2026-04-02
readingTime: 5
tags: ["GITHUB ACTIONS", "CI/CD", "TAILSCALE", "RSYNC", "DEVOPS"]
translationKey: "github-actions"
---
Every time I wrote a new blog article, the flow was the same: finish the HTML, open the terminal, manually run Ansible to copy the files to the server. It worked. But it was manual, boring, and I already understood that's not how it works in the market.

I decided to automate. The goal was simple: any push to the repository's `main` branch should automatically trigger the deployment, without me having to do anything. This article documents how I got there, including all the errors along the way.

##  What I had before

The server was already configured via Ansible: nginx running, Tailscale installed, files in `/var/www/luisbrancher.dev/`. The manual deploy was basically a `git clone` + `chown` that the playbook itself handled.

What I wanted was to eliminate this manual step. Push to repo → site updated. No opening terminals, no running Ansible.

##  The choice: GitHub Actions + rsync

GitHub Actions is GitHub's native CI/CD tool. Each workflow is a YAML file inside `.github/workflows/` in the repository itself. When the configured event happens, in my case a push to `main`, GitHub spins up a runner (an Ubuntu VM), executes the defined steps, and destroys everything at the end.

For the deployment itself, I chose rsync via SSH. Ansible was already using this approach underneath: rsync is the right tool to synchronize files between machines, transferring only what changed.

The server is accessible via Tailscale, so the runner would also need to enter my Tailnet before being able to reach the server.

##  Workflow structure

I created the `.github/workflows/deploy.yml` file:

```yaml
name: Deploy Site

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    env:
      FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Connect on Tailscale
        uses: tailscale/github-action@v2
        with:
          authkey: ${{ secrets.TS_AUTHKEY }}
          args: --accept-routes

      - name: Fix ownership before deploy
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: sudo chown -R admin:admin /var/www/luisbrancher.dev/

      - name: Deploy with rsync
        uses: burnett01/rsync-deployments@7.0.1
        with:
          switches: -avz --delete --exclude='.git/'
          path: ./
          remote_path: /var/www/luisbrancher.dev/
          remote_host: ${{ secrets.SERVER_HOST }}
          remote_user: ${{ secrets.SERVER_USER }}
          remote_key: ${{ secrets.SSH_PRIVATE_KEY }}

      - name: Fix ownership after deploy
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: sudo chown -R www-data:www-data /var/www/luisbrancher.dev/
```

The flow in words:

1. Runner spins up an Ubuntu VM
2. Checks out the repository
3. Enters my Tailnet with an ephemeral auth key
4. Changes the file owner on the server to `admin` (to allow writing)
5. rsync copies the files, excluding the `.git/` folder
6. Reverts the owner back to `www-data` (so nginx can read it)
7. Job finishes → runner is destroyed → automatically leaves the Tailnet

The secrets `TS_AUTHKEY`, `SERVER_HOST`, `SERVER_USER`, and `SSH_PRIVATE_KEY` are stored in **Settings → Secrets and variables → Actions** in GitHub. No credentials in the code.

##  The errors that appeared

It didn't work on the first try. Nor the second. Every error taught me something.

### Error 1 — Permission denied (publickey)

```
Warning: Permanently added '***' (ED25519) to the list of known hosts.
***@***: Permission denied (publickey).
rsync: connection unexpectedly closed (0 bytes received so far) [sender]
```

Tailscale was working, the runner reached the server and registered the host. But SSH rejected the connection.

The problem was the private key registered in the GitHub secret. An ED25519 key needs a newline at the end, and if you copy it without one, it arrives corrupted to the runner and SSH silently rejects it. I recreated the secret by carefully copying it from the terminal.

Even so, the error persisted. Because the key I was using had a passphrase.

The definitive solution was to create a dedicated pair for CI/CD, without a passphrase (the runner cannot interactively type a password):

```
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/id_ed25519_deploy
```

I added the public key to the server:

```bash
ssh -i ~/.ssh/id_ed25519 admin@<IP-tailscale> \
  "echo '$(cat ~/.ssh/id_ed25519_deploy.pub)' >> ~/.ssh/authorized_keys"
```

And registered the private one in the secret. Separate personal and automation keys, it's the right practice anyway.

### Error 2 — rsync: command not found

```
Identity added: (stdin) (github-actions-deploy)
Warning: Permanently added '***' (ED25519) to the list of known hosts.
bash: line 1: rsync: command not found
```

The key was working now. But rsync wasn't installed on the server. Ansible had never needed to install it because it used the `ansible.builtin.git` module to clone the repository, not direct rsync.

```bash
sudo apt install rsync -y
```

### Error 3 — Permission denied on rsync

```
rsync: [receiver] mkstemp "/var/www/luisbrancher.dev/.index.html..." failed: Permission denied (13)
```

rsync connected, but couldn't write the files. The `/var/www/luisbrancher.dev/` directory belonged to `www-data` — the nginx user. The `admin` user didn't have write permissions.

The solution was to add two `chown` steps around rsync: one before to change the owner to `admin`, one after to revert it to `www-data`. Nginx continues reading normally, and rsync can write during the deployment.

### Error 4 — .git/ being copied to the server

In the same log as error 3, you could see the `.git/` folder being sent to the server along with the site files. It makes no sense to have this in `/var/www/`. The fix was adding `--exclude='.git/'` to the rsync switches.

##  What remained

The final workflow solves exactly what I needed. Push to `main` → site updated in seconds, without manual intervention.

The next natural step is to publicly close port 22 in the Security Group via Terraform. Today it is still open, a technical debt documented since the IaC project. With deployments going through Tailscale, there is no longer a reason to keep SSH exposed.

And when the new homelab is up with ArgoCD, the loop closes: GitHub Actions as CI in the site repository, ArgoCD as CD in the cluster. But that's a topic for another post.

### 💡 What I learned

The biggest lesson wasn't technical, it was about troubleshooting. Every error in Actions appears in the log with enough details to understand what happened. The process is: read the error, identify the cause, fix it, commit, push, see the next error.

That's how it works in practice. It's very cool when it works on the first try, but that's not always the reality. What matters is knowing how to read the log and not giving up on the second error.
