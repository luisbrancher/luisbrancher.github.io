---
title: "From a Raspberry Pi with an old HDD to a full home server"
description: "How an attempt to get free cloud storage evolved into a full networking and security lab, motivating my career transition to DevOps."
date: 2026-02-10
readingTime: 5
tags: ["Homelab", "Linux", "Career Journey"]
translationKey: "jornada"
---
It all started with a mix of curiosity and stinginess. I wanted more cloud space, but I didn't want to pay for it.

I had some old hard drives lying around and started researching how I could access them over the internet directly from home. I already had a basic understanding of networking — back in 2000, I used to port-forward on the router to play CS with friends — so that was my first instinct.

But researching further, I discovered that simply exposing ports was no longer best practice. That's when I entered the world of VPNs, and from there I fell into a much deeper rabbit hole: the homelab.

##  The beginning: Raspberry Pi and early attempts

I already had some hardware knowledge from my work as a video editor. I suffered a lot with bad machines over the years, so I was forced to learn in practice about CPU, GPU, RAM, and how each part impacts performance.

I also had a Raspberry Pi 4 sitting in a drawer (which I bought in the past for emulation), so I decided to use it as a starting point.

- connected the HDDs to it
- started with Raspberry OS
- access only via LAN

Then I tried to spin up an Ubuntu Server, but I got stuck on the CLI. I still didn't have enough of a foundation.

I ended up moving to OMV (OpenMediaVault), which was the first setup that really worked as a NAS.

I even managed to configure Tailscale on it, but in practice, I wasn't using it as a "cloud" yet — it was more of a local storage with network backups. I also started playing around with things like Pi-hole.

##  The turning point: real interest in infra

That was the entry point. From then on, I started studying more on my own:

- networking
- communication between machines
- security and privacy
- open source tools

It was precisely when I started diving into the open source world that I really acquired a taste for Linux and the command line. At first, I'd get stuck easily, but today I feel much more comfortable navigating, debugging, and understanding what's happening in the system.

One thing led to another. I started taking courses, studying cybersecurity, and better understanding what I was doing — not just copying tutorials.

With that came new experiments:

- Wazuh (SIEM)
- Suricata (IDS/IPS)
- device hardening
- testing with VMs (VirtualBox / VMware)
- pentest and SOC labs

At this point, the Raspberry Pi couldn't handle it anymore.

##  Upgrade: dedicated server with repurposed hardware

During an upgrade to my work workstation, I repurposed the old parts and built my current server. Today it runs with:

- Ryzen 7 5800X
- 16GB RAM
- GT 1030

Initially, I went back to Ubuntu Server and spun everything up manually (Wazuh + other services), but after a few breakages and losing days in troubleshooting, I realized I was spending more time maintaining than learning.

That's when I decided to simplify and migrate to ZimaOS.

##  Current setup

Today the server runs:

- **ZimaOS** as the base
- **Immich** → personal photo cloud
- **Jellyfin** → media server
- **Zima (NAS)** → files
- **Tailscale** → remote access via VPN
- **UpSnap** → remote Wake-on-LAN
- **MotionEye** → IP camera monitoring

Additionally:

- I use it as a subnet router on Tailscale
- I use it as an exit node to access my network in Brazil

And I still use VMs to test new things before taking them to the server.

##  What changed in practice

The project started just as "I want more storage without paying." It became:

- a real learning environment
- a networking and security lab
- a base to study infrastructure
- and today it directly influences my career transition

###  Conclusion

It wasn't a linear path. There were:

- attempts that didn't work
- system breakages
- lost time debugging the wrong things

But that's exactly what made me understand what I was doing. Today, the server solves real problems for me (backup, remote access, media, etc.) while also serving as my main lab.

And it was this process that made me migrate my interest from video editing to infrastructure and DevOps.
