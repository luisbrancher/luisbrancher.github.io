---
title: "From provisioned server to live site: configuring EC2 with Ansible"
description: "How I configured the Terraform-provisioned server, installing Nginx and Tailscale in an automated and idempotent way using Ansible."
date: 2026-03-31
readingTime: 7
tags: ["ANSIBLE", "AWS", "NGINX", "TAILSCALE", "DEVOPS"]
repo: "https://github.com/luisbrancher/personal-site-infra"
translationKey: "ansible"
---
In the previous post, I ended up with an EC2 running Debian on AWS: custom VPC, least-privilege IAM, boot hardening. The server existed, but it was an empty machine. It was missing what really matters: configuring everything that will run inside it. That's where Ansible comes in.

##  What is Ansible and why is it here

Terraform talks to APIs — it creates resources on AWS, Cloudflare, wherever. Ansible talks to operating systems via SSH. When `terraform apply` finishes, you have a machine. Ansible is what turns that machine into a server. Ansible does not need an agent installed on the server. It connects via SSH, executes what it needs to, and exits. Everything runs from the local machine.

##  Terraform tweaks before starting

Before writing a single line of Ansible, I realized Terraform needed some tweaks, as I bought my domain on Cloudflare and decided to handle DNS there.

The first one: port 80. I had configured the security group with only 443, thinking about HTTPS. But with Cloudflare acting as a proxy, the flow is different: Cloudflare terminates HTTPS and forwards the request to the origin over HTTP. The visitor always sees HTTPS, but the Cloudflare → EC2 communication happens on port 80. Without it open, the site simply doesn't load.

The second: DNS. I bought the `luisbrancher.dev` domain and needed Cloudflare to point to the EC2 IP. Instead of doing this manually in the dashboard, I added the Cloudflare provider directly in Terraform. The result looked like this:

```hcl
resource "cloudflare_record" "site" {
  zone_id = "..."
  name    = "@"
  content = aws_instance.server_debian.public_ip
  type    = "A"
  proxied = true
  ttl     = 1
}
```

The `content` directly references the EC2 IP as a resource attribute. Terraform already knows the order: create the EC2, get the IP, create the DNS record. No workarounds, no fetching the IP manually.

The Cloudflare token was set as an environment variable in HCP Terraform — the same pattern as the AWS credentials. Zero secrets in the code.

##  The Ansible structure

```bash
ansible/
├── inventory.ini
├── group_vars/
│   ├── all.yml
│   └── vault.yml
├── templates/
│   └── nginx.conf.j2
└── site.yml
```

The `inventory.ini` is the map of the machines — it defines where Ansible will connect and with which SSH key. `group_vars/all.yml` centralizes the variables: domain, paths, secret references. `vault.yml` holds the encrypted Tailscale auth key.

About Ansible Vault: instead of exporting environment variables or leaving tokens exposed, Vault encrypts the file with a master password. You commit the encrypted file without issues. When it's time to run, you provide the password:

```bash
ansible-playbook site.yml -i inventory.ini --ask-vault-pass
```

##  The playbook

The playbook has three main blocks.

**nginx** — installs, creates the website directory, applies the configuration via Jinja2 template, and ensures the service is running. The nginx configuration uses a `.j2` file where variables like domain and path are replaced when copied to the server. This way, the same template works for any domain.

One thing I learned here: _handlers_. Instead of restarting nginx every time a task finishes, `notify` accumulates the notifications and triggers a single restart at the end.

**git** — instead of manually copying files, Ansible directly clones the `luisbrancher.github.io` repository into the folder served by nginx. When the site's content changes, just run the playbook again — or in the future, automate it via GitHub Actions.

```yaml
- name: Clone website repository
  ansible.builtin.git:
    repo: "https://github.com/luisbrancher/luisbrancher.github.io.git"
    dest: "{{ site_root }}"
    version: main
    force: true
```

**Tailscale** — installs via the official script and connects the instance to my tailnet with the auth key. After that, the EC2 gets a private hostname within my Tailscale network — `something.tail1234.ts.net`. The idea is that in a next step, port 22 will be closed in the security group and all SSH access will happen exclusively through the tailnet.

##  Idempotency — an important concept

You can run this playbook ten times in a row. On the first run, it installs everything. From the second run onward, it checks the current state and does nothing if it's already correct.

This is idempotency. It is different from a bash script where `apt-get install nginx` simply runs again every time. The `apt` module with `state: present` checks first: is it already installed? If so, skip.

It is this difference that makes Ansible suitable for real automation — and which will allow using this same playbook as a recovery plan if I ever need to recreate everything from scratch.

##  Current infrastructure state

With Terraform and Ansible working together, the flow looks like this:

```bash
terraform apply
  → EC2 created, DNS pointed, IP available in output

ansible-playbook
  → nginx installed and configured
  → site cloned from GitHub
  → Tailscale connected

next steps:
  → confirm access via Tailscale
  → close port 22
  → GitHub Actions for automatic deploy on push
```

The repository with all the code is at [github.com/luisbrancher/personal-site-infra](https://github.com/luisbrancher/personal-site-infra).

### 💡 Lessons

- Ansible and Terraform don't compete — each has its clear domain. Learning where one ends and the other begins was half the learning curve.
- DNS belongs to Terraform, not Ansible. The EC2 IP is already a native attribute of the resource — referencing it directly is cleaner than any workaround.
- Secrets have different tools depending on who consumes them. HCP Terraform for what Terraform uses. Ansible Vault for what Ansible uses.
- Idempotency is not an implementation detail — it's the principle that makes automation reliable.
