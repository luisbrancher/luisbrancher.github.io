---
title: "Redesigning my homelab #04: configuring the network before any server"
description: "Configuring OPNsense on the edge, VLANs with a managed switch, and AP with OpenWrt, plus automation using Ansible."
date: 2026-05-09
readingTime: 6
tags: ["HOMELAB", "NETWORKING", "OPNSENSE", "VLAN", "ANSIBLE"]
repo: "https://github.com/luisbrancher/homelab-network"
translationKey: "novo-homelab-03"
---
While traveling, I started writing my entire homelab in IaC for a redesign and automation of configurations to a new declarative state, all documented here. But upon arriving home, I realized that the first step would be to reconfigure my network, as I brought an n150 appliance to run as my new edge OPNsense, a new 2.5Gbe switch, and a Cudy TR3000 Travel Router that I bought on the trip, which will act as an AP while at home.

To set it up, before plugging everything into the final rack, I decided to build a test bench. The idea was simple: configure the router, switch, and AP from scratch, validate that the VLANs work end-to-end, and only then migrate the real devices. Better to fail on the bench than take down the home network.

The hardware this time: N150 with 4 NICs running bare metal OPNsense, SKS3200-8E2X managed switch, and a Cudy TR3000 with OpenWrt acting as a temporary AP until the Omada EAP650 comes online.

In the end, everything worked, but not without a few resets along the way.

##  BIOS first and foremost

Before booting the OPNsense installer, a few BIOS settings make a difference on a mini PC running as a router:

- **Secure Boot and Fast Boot**: disabled. Secure Boot prevents OPNsense from booting, Fast Boot can cause issues with NIC detection.
- **Power on after AC loss**: enabled as "Power ON". Essential. If the power drops, the router boots up on its own without anyone pressing a button.
- **C-States / CPU Power Management**: disabled. On a router, latency matters more than power saving. Deep sleep CPU states add latency to packet processing.
- **VT-x / Intel Virtualization**: disabled. Not running VMs inside OPNsense, so it's not needed.
- **Wake on LAN**: enabled, just to have the option later.

##  Installing OPNsense

For the disk, I chose **UFS** instead of ZFS. The N150 has 8GB of RAM and will run only as a router. ZFS eats memory and makes sense when you have heavy storage and need snapshots. Here, there are neither, so UFS on the 128GB NVMe is sufficient for the hardware's lifespan.

After the initial boot, OPNsense didn't auto-detect the ports. I had to use the manual auto-detect in the console: unplug and plug the cable in each port while it listens to which interface brought the link up. With 4 NICs, it's easy to mix them up without doing this.

The final port config was:

- `igc0` → WAN (cable from ISP router)
- `igc3` → LAN trunk (cable to switch)
- `igc1` and `igc2` → free for now

An important detail when configuring IPs via console: when it asks **"Restore web GUI access defaults?"**, the answer is always **N**. This option exists to recover lost access, not for initial setup. The first time, I answered Y without thinking and it reset the LAN to 192.168.1.x, which conflicted with the ISP router. I had to reconfigure.

The LAN was set to `10.10.10.1/24` with DHCP between `.100` and `.200`. I chose the `10.10.x.x` range exactly to not collide with the ISP's `192.168.1.x` in the double NAT scenario.

##  VLANs in OPNsense

With the basics working, it was time to create network segmentation. The plan was four VLANs:

| VLAN | ID | Subnet |
| --- | --- | --- |
| trusted | 10 | 10.10.10.0/24 |
| iot | 20 | 10.10.20.0/24 |
| guest | 30 | 10.10.30.0/24 |
| lab | 40 | 10.10.40.0/24 |

The `trusted` one is the existing LAN. The other three were created under **Interfaces → Devices → VLAN**, all with parent `igc3` (the port going to the switch).

After assigning and enabling each interface, I configured the DHCP range in **Services → Dnsmasq → DHCP ranges**: `.100` to `.200` in each, leaving the lower range free for static IPs of servers once the main homelab boots.

##  Firewall rules

OPNsense processes rules top to bottom. First match wins. So I always block before allowing.

Logic by VLAN:

**IoT and Guest**: internet only, fully isolated. First block access to other private networks, then allow any destination.

```
[block] iot_net → lan_net
[block] iot_net → guest_net
[block] iot_net → lab_net
[pass]  iot_net → any
```

Same structure for guest, replacing the destinations.

**Lab**: can talk to trusted, cannot talk to iot or guest.

```
[block] lab_net → guest_net
[block] lab_net → iot_net
[pass]  lab_net → any
```

One thing I learned while testing: you can't block `10.0.0.0/8` all at once to simplify. That includes the `10.10.10.1` gateway, which is OPNsense itself. DHCP and DNS will break. The rules must be specific per destination subnet, using the network aliases (`lan_net`, `iot_net`, etc.) that OPNsense resolves correctly.

##  Configuring the switch

The SKS3200-8E2X is an 8-port managed switch with 2 SFP+. VLAN config is under **Tagged VLAN**.

Before creating anything: **never touch VLAN 1**. It's the default management VLAN. I removed ports from it once, lost access to the switch, and had to factory reset. Learned the hard way.

The port layout became:

| Port | Function |
| --- | --- |
| 1 | Trunk → OPNsense (tagged on all VLANs) |
| 2 to 6 | Access → trusted (untagged VLAN 10) |
| 7 | Trunk → Cudy AP (tagged on all VLANs) |
| 8 | Trunk → Omada EAP650 AP (tagged on all VLANs) |

Trunk ports receive frames with VLAN tags. Access ports deliver untagged traffic to the end device, which doesn't even know a VLAN exists. The switch does all the separation transparently.

##  OpenWrt on Cudy as AP

This is where I spent most of my time. First, I needed to replace the Cudy factory OS with pure OpenWrt, using Cudy's own transition tool acting as a bridge to flash the new OS.

With OpenWrt installed, the goal was to turn it into a dumb AP: disable DHCP, disable routing, and pass tagged VLANs to the switch.

The first steps were straightforward:

- Static IP `10.10.10.5` on LAN
- DHCP disabled (OPNsense distributes IPs)
- WAN interfaces deleted
- Physical port eth0 (2.5GbE) added to LAN bridge

For the trusted SSID, everything worked first try. Untagged traffic leaves the AP, reaches port 7 on the switch which treats it as VLAN 10, and OPNsense delivers IP `10.10.10.x`. Phone connected, internet working.

The issue started when I tried to add the iot SSID on VLAN 20.

The wrong approach was creating the `eth0.20` interface directly and assigning it to the SSID. The device appeared in the system, but the traffic never reached OPNsense. No DHCP logs, no connection attempts. The frame went into limbo somewhere.

The reason: `eth0` is already part of `br-lan`. Creating `eth0.20` on top of it doesn't work as expected because the bridge intercepts the traffic before VLAN tagging happens.

The correct solution is **Bridge VLAN filtering** on `br-lan`. In **Network → Interfaces → Devices → br-lan → Bridge VLAN filtering**, you enable and configure which VLANs pass through which ports.

Attempt 1: I enabled filtering and added only VLAN 20 as tagged. Applied. The AP became inaccessible, automatic OpenWrt rollback. Physical reset.

Attempt 2: I enabled filtering, added VLAN 20 tagged and VLAN 1 untagged. VLAN 1 ensures management traffic keeps flowing after the apply. Applied with "unchecked configuration apply" to skip waiting for connectivity confirmation. It worked.

After applying, OpenWrt auto-created devices `br-lan.1` and `br-lan.20`. I edited the `lan` interface to use `br-lan.1` as device (necessary tweak via SSH in `/etc/config/network`), created the `iot` interface pointing to `br-lan.20`, and tied the iot SSID to this interface.

Phone connected to `lfck-iot_2g`, IP `10.10.20.x` via OPNsense DHCP. End-to-end working.

##  Ansible: from scratchpad to real execution

With everything manually validated, the next phase was turning the process into code and running it for real. This step taught me the most about the difference between writing Ansible and executing Ansible.

Three files in the repo: `hosts.ini` with inventory, `setup_opnsense.yml` to provision OPNsense via SSH and REST API, and `setup_cudy_ap.yml` to configure OpenWrt via SSH.

The initial connectivity test:

```bash
ansible -i ansible/hosts.ini opnsense -m ping --ask-vault-pass
ansible -i ansible/hosts.ini cudy_ap -m raw -a "/bin/true" --ask-vault-pass
```

Two problems right off the bat.

**Problem 1**: the `ansible_user` created on OPNsense had no shell access. Ping failed with authentication error. I allowed shell access in the OPNsense dashboard and it was fixed.

**Problem 2**: the hostname in the inventory duplicated the group name. I renamed the host from `opnsense` to `n150` in `hosts.ini` to prevent conflicts.

After ping worked on both:

```
n150 | SUCCESS => { "ping": "pong" }
cudy_ap | CHANGED | rc=0
```

I ran `setup_opnsense.yml` and the real errors started.

**Collection**: the `oxlorg.opnsense.firewall_rule` module didn't exist. The correct name in the collection is `oxlorg.opnsense.rule`. A one-line diff, half an hour of debugging reading documentation.

**become**: I added `become: true` to run commands like sudo on OPNsense. It didn't work, FreeBSD behaves differently than Linux here. Pragmatic fix: swapped directly to `ansible_user=root`.

**Firmware update**: `poll: 0` caused Ansible to fire off the update and move on without waiting for it to finish, breaking the subsequent tasks. Removed `poll: 0` so it'd wait for the update to complete before continuing. I also added a `wait_for` on port 443 to wait for OPNsense to come back online after the reboot.

**changed\_when**: tasks like kernel optimization and PowerD reported `changed` every run, even when they didn't alter anything. I added `changed_when: false` to naturally idempotent tasks to keep the output clean.

The most interesting issue was DHCP. While running the playbook, I noticed resources were being created in **Kea DHCP** instead of Dnsmasq. OPNsense 26.x migrated to Kea as the default DHCP service. I decided to keep and adapt: configured everything in Kea and added a task at the end to completely disable Dnsmasq, leaving just one active service.

Another tweak: VLANs in OPNsense are referenced internally by identifiers (`opt1`, `opt2`, `opt3`), not by the names you set in the UI. Firewall rules and DHCP config must use these identifiers. I had to map them manually in the loop:

```
- { friendly_name: 'iot', internal_iface: 'opt1', source_net: '10.10.20.0/24', ... }
```

In `setup_cudy_ap.yml` the issue was different: OpenWrt doesn't have Python installed by default. The Ansible `shell` module relies on Python on the remote host. I switched all `shell` tasks to `raw`, which executes commands directly over SSH without needing an interpreter.

The final bug was on the SSIDs. The early version used `uci add wireless wifi-iface` — which creates anonymous entries without a name. When Ansible checked if the SSID already existed on the next run, it couldn't find it by name and created a duplicate. The fix was using `uci set wireless.wifinet_trusted=wifi-iface` with an explicit name, making the operation idempotent by default.

After all these tweaks:

```bash
ansible-playbook -i ansible/hosts.ini ansible/playbooks/setup_opnsense.yml --ask-vault-pass
ansible-playbook -i ansible/hosts.ini ansible/playbooks/setup_ap.yml --ask-vault-pass
```

All green.

##  What's done

Test bench working with IaC validated end-to-end:

- OPNsense routing and enforcing stateful firewall between VLANs
- Switch pushing VLANs via trunk to correct ports
- AP broadcasting trusted and iot on separate SSIDs, each handing out IPs for the correct subnet
- DHCP responding successfully on each VLAN via Kea
- Static IPs reserved for switch, AP, and workstation
- Internet working via ISP's double NAT
- Idempotent playbooks — can run multiple times with no side effects

The next step is to plug the Omada EAP650 into port 8 of the switch, add guest and lab SSIDs, and migrate the current network devices. After that, Unbound DNS for internal homelab subdomains resolution and Tailscale on OPNsense.

The code is up on [homelab-network](https://github.com/luisbrancher/homelab-network).
