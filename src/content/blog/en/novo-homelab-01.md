---
title: "Redesigning my homelab #01: planning, hardware, and Terraform"
description: "Planning and provisioning of my new homelab architecture using Proxmox, k3s, and Terraform to manage everything as code."
date: 2026-04-04
readingTime: 6
tags: ["HOMELAB", "TERRAFORM", "PROXMOX", "IAC", "DEVOPS"]
repo: "https://github.com/luisbrancher/homelab-infra"
translationKey: "novo-homelab-01"
---
I've been traveling for a few months and meanwhile my homelab at home is running and serving me as a NAS file server, Brazilian exit node, and some other services, like UpSnap to turn on my workstation at home when necessary. But after a slight headache with a power outage ([described in this article](../drp/)), I already consider it retired. A Ryzen 5800X with ZimaOS, everything in Docker Compose, without any serious organization. It works, but it's far from what I want.

When I return to Brazil, I will rebuild everything from scratch. And since I have time here on the trip, I decided to plan properly before touching the hardware. Write the code, think about the architecture, leave everything ready to just get home and execute.

This article is the beginning of this series. I'll talk about the new hardware, the architecture I chose, and how I'm using Terraform to provision everything professionally.

##  The new hardware

The main motivation for the change was energy efficiency. Today I use a 5800X that was left over here from a workstation upgrade. It's an excellent processor, but it consumes quite a bit of energy to run 24/7 as a server. The new stack is much leaner:

- **i5 1345U** (Chatreey TK-13F): main server, 16GB DDR4 SO-DIMM with a slot to expand to 32GB later
- **N150** (4 NICs): dedicated router running OPNsense bare metal
- **Raspberry Pi 4**: auxiliary network services and cameras

The i5 1345U is a mini PC with much lower consumption than a desktop, but a 13th-gen processor with 12 cores. More than enough to run Proxmox with a few VMs.

##  The architecture

Instead of installing everything directly on the OS like I did before, this time I will use Proxmox as a hypervisor and divide responsibilities into separate VMs:

```
Proxmox (i5 1345U)
├── VM: k3s-node        → all main services
├── VM: storage-server  → NFS and backups
└── LXC: lxc-monitoring → Prometheus + Grafana + Loki

N150
└── OPNsense bare metal → router, firewall, VLANs

Pi4
├── Omada Controller    → AP management
├── MotionEye           → cameras
└── UpSnap              → Wake-on-LAN
```

The central point is **k3s** running on the main VM. k3s is a lightweight Kubernetes distribution that replaces Docker Compose with a declarative model. You describe the desired state of your services via YAML manifests and it continuously ensures everything is running. If a container crashes, it restarts automatically. Want to update an image? Change the manifest, do a git push, and ArgoCD applies it to the cluster by itself.

The `storage-server` doesn't run any application service. It just exports volumes via NFS that the k3s-node mounts to persist data from Jellyfin, Immich, and the like. Dedicated 100GB disk separate from the OS.

The monitoring LXC intentionally runs outside of k3s. If the main VM restarts, Prometheus and Grafana stay up and you can see exactly what happened.

The Pi4 was left with services that don't make sense inside Proxmox: Omada Controller to manage the TP-Link APs and MotionEye for cameras. Services that need to be available regardless of the main server's state.

And Tailscale goes on all machines via Ansible, providing secure remote access to everything without exposing anything to the internet.

##  The complete IaC stack

What changed compared to my previous setup is that this time I want to treat the homelab as real infrastructure. Each piece has a responsible tool:

```
Terraform   → creates VMs on Proxmox
     ↓
Ansible     → configures the OS of each VM
     ↓
k3s         → orchestrates containers
     ↓
ArgoCD      → GitOps, deploy via git push
```

No manual SSH, no "let me remember what I installed on this machine". If the hardware dies tomorrow, I install Proxmox on the replacement and run three commands.

##  Terraform

I started with Terraform because it's the first layer. Without the VMs created, Ansible has nowhere to run.

The provider I used was `telmate/proxmox`, which is the most mature for this purpose. The project structure looked like this:

```
homelab-infra/
├── terraform/
│   ├── main.tf                   → terraform block + proxmox provider
│   ├── variables.tf              → all centralized variables
│   ├── outputs.tf                → VM IPs after apply 
│   ├── vm_k3s-node.tf
│   ├── vm_storage-server.tf
│   └── lxc_monitoring.tf
```

One file per VM. When I need to adjust only the k3s-node RAM, I go straight to `vm_k3s-node.tf` without navigating a giant `main.tf`.

The main k3s VM looked like this:

```hcl
resource "proxmox_vm_qemu" "k3s_node" {
  name        = var.k3s_server
  target_node = var.proxmox_node
  vmid        = 9000

  clone  = var.vm_template

  cores  = 4
  memory = 8192

  network {
    bridge = var.network_bridge
    model  = "virtio"
  }

  ipconfig0 = "ip=dhcp"
  sshkeys   = var.ssh_public_key_homelab
}
```

The logic is the same I used to create an EC2 on AWS ([here](../iac-terraform/)). You declare the desired state and Terraform ensures it exists. The difference is that instead of calling the AWS API, it calls the Proxmox API.

The `storage-server` has an additional 100GB disk declared separately from the OS disk. This is the volume that will be exported via NFS later:

```
disk {
  type    = "scsi"
  slot    = 1
  size    = "100G"
  storage = var.data_storage_pool
}
```

And the monitoring LXC uses a different resource than the VMs. `proxmox_lxc` instead of `proxmox_vm_qemu`, because LXC doesn't emulate complete hardware, it shares the Proxmox kernel, and it's much lighter for services that don't need full isolation:

```hcl
resource "proxmox_lxc" "monitoring" {
  hostname    = var.monitoring_server
  target_node = var.proxmox_node
  vmid        = 9020

  ostemplate = var.lxc_template

  cores  = 2
  memory = 1024

  network {
    name   = "eth0"
    bridge = var.network_bridge
    ip     = "dhcp"
  }

  rootfs {
    size    = "20G"
    storage = var.storage_pool
  }

  ssh_public_keys = var.ssh_public_key_homelab
}
```

Sensitive variables (Proxmox password and SSH key) stay in HCP Terraform and never enter the repository. Same pattern I use in the `luisbrancher.dev` infra.

##  Next steps

This was the planning and the first IaC layer. In the next articles I will cover:

- **Ansible**: OS configuration of the VMs, k3s installation, NFS and Tailscale setup on everything
- **k3s**: first services running, Traefik as ingress, cert-manager for automatic TLS
- **ArgoCD**: real GitOps, deploy via git push

The code is on GitHub at [luisbrancher/homelab-infra](https://github.com/luisbrancher/homelab-infra) if you want to follow along.
