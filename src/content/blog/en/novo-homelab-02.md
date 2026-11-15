---
title: "Redesigning my homelab #02: Ansible, NFS, and three days frying my brain"
description: "The layer that comes after Terraform: configuring VMs from scratch idempotently using Ansible, with NFS, Tailscale, and Node Exporter."
date: 2026-04-08
readingTime: 6
tags: ["HOMELAB", "ANSIBLE", "NFS", "PROXMOX", "DEVOPS"]
repo: "https://github.com/luisbrancher/homelab-infra"
translationKey: "novo-homelab-02"
---
In the previous article ([here](../novo-homelab-01/)) I talked about the planning, the new hardware, and Terraform to provision VMs in Proxmox. Today is Ansible's turn, the layer that comes in after the VMs exist and configures everything from scratch.

Spoiler: these were the most intense days so far. A lot of new things at the same time, plenty of doubts along the way, and a few "why isn't this working?" moments. But in the end it made sense, and I think showing this whole process is more useful than pretending I wrote everything perfectly on the first try.

##  What Ansible does in this stack

After `terraform apply`, you have VMs created but completely blank. Clean Debian 12, with nothing installed. Ansible connects via SSH to each one and runs a sequence of tasks to get everything configured: installs packages, formats disks, configures services, injects config files via templates.

The difference from what I used to do before (a bash script or following a tutorial) is that Ansible is **idempotent**. You can run the same playbook ten times and the result is always the same. If the package is already installed, it doesn't install it again. If the service is already running, it doesn't restart it. This changes how you think about server configuration.

##  The structure

The first question was: one giant playbook or multiple files? I started with the idea of an all-in-one `proxmox.yml`, but as I was writing it became obvious that each VM deserved its own file. The final structure looked like this:

```bash
ansible/
   ├── inventory.ini             → hosts and groups
   ├── site.yml                  → main entrypoint, imports all playbooks
   ├── group_vars/all/
   │   ├── vars.yml              → shared variables
   │   └── vault.yml             → encrypted secrets (Ansible Vault)
   └── playbooks/
        ├── proxmox.yml           → imports all Proxmox playbooks
        ├── k3s-node.yml          → k3s + Tailscale + Node Exporter
        ├── storage-server.yml    → NFS + Tailscale + Node Exporter
        ├── monitoring.yml        → Prometheus + Grafana + Loki + Tailscale
        ├── pi4.yml               → Omada + MotionEye + Tailscale + Node Exporter
        └── templates/
             ├── exports.j2            → /etc/exports (NFS)
             ├── prometheus.yml.j2     → Prometheus scrape config
             ├── grafana.ini.j2        → Grafana config
             ├── loki-config.j2        → Loki config
             ├── loki.service.j2       → Loki systemd service
             └── upsnap.service.j2     → UpSnap systemd service
```

`site.yml` is the entrypoint for everything. You run `ansible-playbook site.yml` and it configures each machine in the right order. But you can also run just a specific playbook when you need to reconfigure only monitoring, for example.

##  The inventory and variables

One thing I learned early on: don't repeat configuration. `inventory.ini` only contains what is unique to each host, IP, and group:

```
[proxmox_vms]
k3s-node       ansible_host=<IP>
storage-server ansible_host=<IP>
lxc-monitoring ansible_host=<IP>

[pi4]
pi4 ansible_host=<IP>
```

The rest (SSH user, key, become) goes into `group_vars/all/vars.yml` and applies to everything automatically. If I change the SSH key one day, I change it in just one place.

The secrets are kept in `vault.yml` encrypted with Ansible Vault: Grafana password, Tailscale auth key. The file goes to git encrypted, the values are never exposed.

##  k3s-node: simpler than it seemed

The k3s-node playbook was the most straightforward. k3s has an official installation script that handles everything:

```yaml
- name: Download and run k3s install script
  ansible.builtin.shell:
    cmd: curl -fsSL https://get.k3s.io | sh
    creates: /usr/local/bin/k3s
```

The `creates` is what guarantees idempotency here. If the binary already exists, the task is skipped. No need to check the version or anything, just check if the binary is there.

After that: ensure the service is running on boot, install Node Exporter to expose metrics to Prometheus, and install Tailscale. This pattern of Tailscale + Node Exporter repeats on all machines, it's transversal infrastructure.

##  storage-server: where I learned about NFS for real

I had never configured NFS seriously before. I knew what it was, but in practice I always used Samba or direct access. Here there was no way around it.

The flow is: format the extra disk, mount it, create the directories for each service, and export via NFS. Ansible has specific modules for each step:

```yaml
- name: Format disk with ext4
  community.general.filesystem:
    fstype: ext4
    dev: "{{ storage_device }}"

- name: Mount disk and add to fstab
  ansible.builtin.mount:
    path: "{{ storage_mount }}"
    src: "{{ storage_device }}"
    fstype: ext4
    opts: defaults
    state: mounted
```

The `mount` with `state: mounted` does two things at once: mounts the disk now and adds it to `/etc/fstab` to persist after a reboot. One module, two problems solved.

The data directories use a `loop` over the same list that defines the NFS exports, the single source of truth:

```yaml
- name: Create data directories
  ansible.builtin.file:
    path: "{{ item.path }}"
    state: directory
    mode: '0755'
  loop: "{{ nfs_exports }}"
```

When I add a new service, I just add an entry in `vars.yml` and it automatically creates the directory and exports it via NFS. No risk of creating the directory and forgetting to export it.

The `/etc/exports` is generated by a Jinja2 template:

```
{% for export in nfs_exports %}
{{ export.path }}   {{ export.clients }}({{ export.options }})
{% endfor %}
```

And the client IP (who can mount the NFS) is not hardcoded. It comes straight from the inventory:

```
k3s_node_ip: "{{ hostvars['k3s-node']['ansible_host'] }}"
```

If the IP changes in the inventory, exports is automatically updated the next time the playbook runs.

##  monitoring: the most laborious

Prometheus and Grafana were smooth, both have official packages, just add the repository and install. Loki was another story.

Loki doesn't have an official `.deb` package. It only has a binary on GitHub. So I had to manually do everything that `apt` would do automatically in a normal package: create a system user, download and unpack the binary, create config directories, generate the config file via template, and create a `.service` file for systemd.

This last point was one of the most interesting parts. For any process to become a service managed by the system (start on boot, restart if it crashes) it needs a `.service` file in `/etc/systemd/system/`. It's basically the OS-level equivalent of Docker Compose's `restart: unless-stopped`:

```
[Service]
User=loki
ExecStart=/usr/local/bin/loki -config.file=/etc/loki/config.yml
Restart=always
```

Ansible generates this file via template and uses a handler to do `daemon-reload` and start the service. It only runs when the file was created or modified, not every time the playbook executes.

A doubt I had here: why not run Loki in Docker inside the LXC? The answer is that it would be unnecessary overhead. The LXC is enough isolation, adding Docker on top would be an extra layer with no real benefit.

##  Pi4: ARM has its peculiarities

The Pi4 runs Debian ARM, and that brought a catch that almost went unnoticed. The TP-Link Omada Controller provides separate installers by architecture. The standard you find in most tutorials is `linux_x64`, but on the Pi4 it is `linux_aarch64`. Installing the wrong version on an ARM fails silently in the best case.

MotionEye has no package in Debian 12's apt, it installs via pip. And both Omada and MotionEye are configured via their web interface after being installed, so Ansible only needs to install and ensure they are running. No config templates here.

For UpSnap I had to download the binary on GitHub. And just like with Loki, I had to manually do everything `apt` would do. I used a Jinja2 template for the systemd `.service`. A different point from Loki, which stores data locally in the LXC, UpSnap persists config via NFS mounted from the storage-server, so I also had to install the NFS client via `apt` here.

##  Imposter syndrome or just lack of practice?

During the day I had a strange feeling. I knew what each thing was doing, I could explain the logic, but without reference I wouldn't have reached the right syntax on the first try. Is this imposter syndrome or is this just how learning works?

I think it's the second option. No one memorizes the syntax of `ansible.builtin.mount` the first time. The difference between blindly following a tutorial and truly learning is being able to explain what each line does and why, and I can do that. The rest is repetition.

##  Next steps

With Terraform and Ansible ready, the infrastructure is defined from scratch to configured OS. The next step is k3s itself: YAML manifests for each service, Traefik as ingress, cert-manager for automatic TLS, and ArgoCD to close the GitOps loop.

All this while still traveling, before returning to Brazil and finally executing all this on real hardware.

The code is on GitHub at [luisbrancher/homelab-infra](https://github.com/luisbrancher/homelab-infra) if you want to follow along.
