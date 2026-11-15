---
title: "Four months running: what I changed by hand and what a review found"
description: "After four months of using my homelab, I took stock of what I'd changed by hand and asked for a review of all three repos before starting on observability: databases with no backup, firewall gaps, and risky playbooks."
date: 2026-11-02
readingTime: 5
tags: ["HOMELAB", "REVIEW", "BACKUP", "OBSERVABILITY", "TERRAFORM", "ANSIBLE"]
repo: "https://github.com/luisbrancher/homelab-network"
repos: ["https://github.com/luisbrancher/homelab-network", "https://github.com/luisbrancher/homelab-infra", "https://github.com/luisbrancher/homelab-gitops"]
translationKey: "revisando-homelab"
---
The last post in the [Redesigning my homelab](../homelab-07-truenas-gitops/) series ended in late June, with the new NAS and the first real deploy of `homelab-gitops`: Nextcloud, Immich, and Jellyfin up and running, managed by ArgoCD. From there I stopped building and started using it.

Using it is a different thing. Over four months, what was in the code and what was actually running drifted apart a little, always for a good reason at the time.

##  What changed by hand

The most annoying problem was the Proxmox host's network card. Under heavy traffic it would hang and take the whole server down with it in a freeze. At first I didn't even suspect it. I bumped the k3s VM from 8 to 16 vCPUs to test whether it was a CPU shortage, and it wasn't. The real cause was the card: the fix was to turn off the offloads and move packet processing to the CPU. The freezes stopped.

The 16 vCPUs stayed. The M80q's i5-13500T has 20 threads, so it doesn't go over the limit, but there was also no reason for it other than me forgetting to change it back. I even updated Terraform to match what I'd done by hand instead of undoing it.

Jellyfin got a dedicated SSD. Downloading, watching, and deleting on the OS disk made no sense, so the media moved to a disk of its own. That change also needed a manual fix: the playbook pointed at the wrong disk, and the machine only ended up right because I fixed the fstab by hand, twice. The second time was after a power outage.

And the M80q went from 16GB to 32GB of RAM, because with everything running it was already tight. I've been running a few test VMs on it too.

None of this is outrageous. Each change solved a real problem. But the Proxmox `/etc/network/interfaces` isn't in any repo, and if I reinstalled the host tomorrow, the freeze would come back. I kept piling up this kind of thing without a list.

##  The internship changed the priority

Then I started a DevOps internship focused on observability. I want to practice at home what I'm studying, with Prometheus, Loki, Alertmanager, and Alloy on top of the homelab. The monitoring LXC does exist, but it's pretty empty: Loki is up and nothing sends logs to it.

Before putting more load on top, I wanted to know what was fragile. And there was a problem: the person looking was the same person who built it all, with the same assumptions and the same blind spots.

So I asked Claude Opus to read the three repos (`homelab-network`, `homelab-infra`, and `homelab-gitops`) and point out the problems. Read-only, changing nothing. We also went through the git history looking for leaked secrets, and the `vault.yml` files have been encrypted since the first commit, which was expected, since I've always put some focus on the security side.

The rest was less reassuring.

##  What turned up

A few examples:

- Guest and IoT could reach the OPNsense web interface and SSH, because the block covered the other VLANs but not the gateway's own IP.
- The Immich and Nextcloud Postgres databases had no backup at all. The photos are on the NAS, but albums, faces, and metadata are in the database, on the VM's local disk. Nothing vital, but it makes a future restore easier.
- Running the OPNsense playbook to change a DHCP reservation could upgrade and reboot the router.
- Re-running the access point playbook deleted a firewall zone, whichever one happened to be at index 1 at the time.
- Both pools on the NAS are striped, with no redundancy. That was my choice and it still is, but I had no scheduled SMART tests and no alerts at all. And the backup copy lived in the same box.

Some of it I knew about and had put off, some of it surprised me. What got me the most was the firewall: Guest and IoT being able to reach the OPNsense web interface and SSH is the most serious security flaw on the list. The database surprised me too: I had snapshots and replication between pools, and I thought that meant everything was backed up.

##  How I organized it

Along with the findings, I answered a list of open questions, because some of the answers changed the priority. Was the Cudy AP still in production? Why 16 vCPUs? That brought out things only I knew, like the network card story.

The result became a review document with three levels:

| Level | What it means | Examples |
| --- | --- | --- |
| Serious | Can cause data loss or exposure | Firewall, database with no backup, media disk |
| Important | Will come due, just not today | Floating versions, secrets only in the cluster, IPs outside the code |
| Improvement | I'd do it differently, no rush | Redis on Nextcloud, Ansible roles, QSV on Jellyfin |

Severity tells you what's worse, but not what order to tackle things in. For that I split the work into phases, using the internship as the reference:

- **Phase 1:** close the critical items before observability, plus whatever avoids rework later.
- **Phase 2:** observability, with the backup alerts already included.
- **Phase 3:** the rest, like pinning versions, taking care of secrets, and moving what's left to GitOps.

The order inside a phase matters too. One example: separating the OPNsense upgrade had to come before touching the firewall through code, because applying the playbook could still reboot the router.

I also tagged each action as `[code]`, `[console]`, or `[both]`. Anything done in the interface gets its exact value written down on the spot. That's the rule to avoid repeating what happened with the network card.

##  What I already wanted to do

Not everything came from the review. I already had a list of things I wanted to do, and it went in too:

- Replace `homelab.luisbrancher.dev` with a domain of its own, `lflab.cc`, before observability, so probes and dashboards start out with their final names.
- A simple page, `all.lflab.cc`, with links to everything. Right now I'm always hunting for IPs and ports.
- Replace the Proxmox and TrueNAS network cards with M.2 2.5G ones. While I'm at it, I'll migrate from the Cudy AP to the Omada, which is already waiting.
- An 8TB external HD for one more copy of the data.
- A UPS, which I've already bought. Power outages played a part in several of the problems here.

Putting everything in the same document helped me see that some things depended on each other. Swapping the card, for example, changes the MACs, and the IPs depend on DHCP reservations that aren't even in the code.

##  What I took from it

Before changing a single line, I'd already taken two things from this review. The first is that "it's working" said very little about my homelab. The databases went four months without a backup, and nothing complained at any point.

The second is that a review like this only sees what's written down. The README still said the host was an i5-1345U, the processor of a mini PC that burned out before I bought the M80q, and Claude flagged the 16 vCPUs as more than the total thread count. The i5-13500T has 20. I only caught that much later, rereading the text. The outside view helped a lot, but checking it is still on me.

The next step is to go through phase 1 item by item, with a diff and `--check` before applying, and writing down whatever gets done in the interface. Observability starts after that.
