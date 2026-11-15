---
title: "Disaster Recovery and Network Resilience across 10,000km"
description: "How I re-established access to my main server that had disappeared from Tailscale after a power outage using IPv6 and resilience strategies."
date: 2026-03-24
readingTime: 6
tags: ["Disaster Recovery", "Networking", "Troubleshooting"]
translationKey: "drp"
---
I am traveling for 3 months across different countries. Before leaving, I configured my home server as a sort of digital embassy: remote access to my services, an exit node in Brazil via Tailscale for when I need a Brazilian IP, and RustDesk on the workstation as an alternative entry point into the LAN. The idea was to have total autonomy even from 10,000km away.

Until a storm in Blumenau knocked out the power in my apartment and my server (ZimaOS / Ryzen 7 5800X) simply disappeared from Tailscale.

Even with the auto-restart setting, I imagined it might not have booted correctly, whether due to hardware failure, a boot issue, or even some service not starting properly (Docker / Tailscale).

I asked someone to go to the location to check. The server was on, but even after a reboot, the problem persisted: it quickly connected to Tailscale and then immediately went offline again.

Since the person there lacked technical knowledge (my mom), I also asked her to turn on my main computer which is on the same LAN. I am traveling, so the idea was to use it as an entry point. With the PC on, I managed to access it via RustDesk (I leave it configured exactly for this) and investigate the problem from inside the network.

The first attempt was to access the server via direct IPv4: no success. However, I managed to access it via hostname (`zimaos.local`), which already showed the system was running. Even so, I couldn't access the terminal via the web interface or via SSH using IPv4. I tried restarting the system through the dashboard, but it didn't solve it.

I then decided to test pinging the hostname:

```
C:\Users\luisf>ping zimaos.local

Pinging zimaos [fe80::739e:13e:d85e:d7ad%4] with 32 bytes of data:
Reply from fe80::739e:13e:d85e:d7ad%4: time<1ms
```

It replied with a link-local IPv6 address. That's what allowed me to continue.

Using this IPv6, I managed to access via SSH. Once inside the server, I ran:

```
lfck@ZimaOS:~ ➜ $ ip addr
```

And saw the interface was like this:

- Static IPv4: 192.168.1.250
- IPv6 working normally

That .250 was an IP I had manually configured before.

To ensure it wasn't something more superficial, I tested the filesystem (touch), stopped services like Docker, but nothing changed.

I then decided to revert the interface to DHCP:

```
lfck@ZimaOS:~ ➜ $ sudo dhclient -v eth1
...
DHCPOFFER of 192.168.1.7 from 192.168.1.1
...
bound to 192.168.1.7
```

It grabbed the IP 192.168.1.7, but even so:

- couldn't access via this IP
- had no external ping response
- it seemed there was no outbound routing

I tried forcing the gateway:

```
lfck@ZimaOS:~ ➜ $ sudo ip route replace default via 192.168.1.1 dev eth1
lfck@ZimaOS:~ ➜ $ ping -c 4 8.8.8.8
```

No response.

That's when I ran:

```
lfck@ZimaOS:~ ➜ $ ip route show
```

And saw something strange:

```
192.168.1.0/24 dev eth1 ... src 192.168.1.7
192.168.1.0/24 dev eth1 ... src 192.168.1.250 metric 100
```

That is, two routes for the same network, with two different IPs on the same interface.

I manually removed the old IP and restarted the main services:

```bash
sudo ip addr del 192.168.1.250/24 dev eth1
sudo systemctl restart zimaos-gateway.service
sudo systemctl restart zimaos.service
sudo iptables -F
sudo iptables -t nat -F
```

Even then, I still had no external connectivity.

At this point, I began to suspect the problem wasn't just on the server. I ran a network scan:

```
luisf@LFckdsk:~$ sudo nmap -sn 192.168.1.0/24

Nmap scan report for 192.168.1.200
Host is up (0.00040s latency).
Nmap done: 256 IP addresses (1 host up)
```

Only my own machine appeared.

Other devices on the network (like an IP camera) were working normally, but weren't detected in the scan. Not even the router itself appeared.

This indicated that the local IPv4 network was inconsistent — probably something in the router after the power outage (ARP/cache or stuck internal state).

The ideal here would be to reboot the router, but I had no one else on-site to do that.

As an alternative, I configured access via Zima Remote (HTTPS tunnel) to maintain control of the server even with unstable Tailscale, and also to use the SnapUp service and ‘wake up’ my workstation to use it as an alternative access point and exit node when necessary.

After that, without a clear change that I can assert with certainty, the network started to return to normal:

- Tailscale stabilized
- ping started responding again
- I ran Nmap again and all devices reappeared

In other words, the network "unlocked" — possibly because the router finally recovered or updated its internal state. It's impossible to state exactly what the trigger was.

The most likely hypothesis is that it all started with:

- conflict between the static IP (.250) and DHCP
- coupled with an inconsistent router state after the power outage

This ended up breaking local IPv4 connectivity for a while.

After everything normalized, I re-established access via Tailscale (including subnet and exit node) and had no further issues.

### 💡 Lessons

- IPv6 saved access when IPv4 failed
- having a second entry point on the LAN (RustDesk) was essential
- in a home network, DHCP with reservation is usually more reliable than a static IP on the host
- ISP router can become the most fragile point of the infrastructure
- not every incident has a 100% provable cause, and that's fine — the important thing is to isolate coherent hypotheses and restore the service
