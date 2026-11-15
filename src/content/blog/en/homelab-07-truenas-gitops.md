---
title: "Redesigning my homelab #07: dedicated NAS, GitOps up and running, and the first experience with Kubernetes and ArgoCD"
description: "Setting up a dedicated TrueNAS from scratch and running the first real deploy of homelab-gitops: ArgoCD, Nextcloud, Immich, and Jellyfin, with every error along the way."
date: 2026-07-07
readingTime: 12
tags: ["HOMELAB", "TRUENAS", "ARGOCD", "GITOPS", "TROUBLESHOOTING"]
repo: "https://github.com/luisbrancher/homelab-gitops"
repos: ["https://github.com/luisbrancher/homelab-gitops", "https://github.com/luisbrancher/homelab-infra"]
translationKey: "homelab-07-truenas-gitops"
---
I'd known for a while that the homelab's storage needed a better solution. I had a `storage-server` VM running inside Proxmox itself, with a SATA disk passed through, exporting NFS to the other services. It worked, but it was a hack: storage running on the same hardware as the cluster, eating CPU and RAM, the only redundancy was a backup on an external HD, and no decent interface to manage it.

The solution came in the form of a Lenovo V50s I found cheap on a local marketplace: i3-10100, 8GB RAM, a free PCIe slot. It became the dedicated NAS. And with the new NAS configured, I finally had the right environment to run the first real deploy of `homelab-gitops`, the repo I'd been building for a few months that had never actually run on a cluster.

This post covers both fronts: setting up TrueNAS from scratch on the V50s, and running the first ArgoCD deploy with Nextcloud, Immich, and Jellyfin. With every error along the way.

##  The NAS hardware

The plan was to fit four disks: two 1TB SSDs for active data and two 1TB HDDs for backup. I bought a PCIe SATA card (ASM1166) to get enough ports, and a 2.5GbE network card I already had lying around for more NFS bandwidth.

The first problem showed up right here: the two PCIe cards together didn't work. The system recognized one or the other, never both at the same time. A PCIe bus limitation on the V50s. I had to choose: the SATA card stayed, the 2.5GbE went. For now the NAS runs on the onboard 1GbE NIC, to be solved later with an M.2 network adapter.

##  TrueNAS 25.10

I installed TrueNAS 25.10 on the V50s's dedicated M.2. The install itself isn't much of a mystery, but there are a few BIOS details that matter:

- **Secure Boot**: disabled, TrueNAS won't boot with it on
- **Wake on LAN**: enabled, useful for powering the NAS on remotely
- **Power on after AC loss**: enabled as Power ON, so the NAS comes back on its own after a power cut

After the initial boot I set the static IP `10.10.10.15` and enabled SSH. One thing I learned quickly: TrueNAS's root filesystem is read-only. You can't install software via a shell script. Tailscale, for instance, had to be installed via **Apps → Discover → Tailscale** in the UI, not the `curl | sh` I use in Ansible.

### Pools and datasets

I created two ZFS stripe pools: `data-ssd` with the two SSDs, and `backup-hdd` with the two HDDs. Stripe with no redundancy: if one disk fails, the whole pool is gone. I know the risk and I'm accepting it consciously because I have automatic replication between the pools.

Inside `data-ssd` I created one dataset per service: `nextcloud`, `immich`, `jellyfin`. Each became an NFS share. I also set up a 24h Periodic Snapshot Task with a two-week retention, plus a Replication Task that copies everything from `data-ssd` to `backup-hdd` automatically after each snapshot.

### Changes in homelab-infra

With the new NAS, `storage-server` stopped existing. I removed the VM from Terraform (`terraform state rm` before deleting the code), took it out of the Ansible inventory, and updated the variables that pointed to the old paths. `nfs_server` in `vars.yml` now points to TrueNAS instead of the VM.

Two bugs showed up in the services that depended on the old NFS. MotionEye on the Pi4 stopped starting after reboot because the `/run/motioneye` directory is ephemeral and disappeared. Fix: add `RuntimeDirectory=motioneye` to the systemd service via Ansible. UpSnap complained about permissions on the NFS mount because NFS exports with `root_squash` by default, mapping the client's root to `nobody`. Fix: `chmod 777` on the dataset from TrueNAS as root, and `no_root_squash` in the export options.

##  First homelab-gitops deploy

With the NAS up and the paths updated in `homelab-gitops`, it was time to actually run what I'd been writing over the past few months. The README sequence looked simple, but in practice it took several hours of debugging.

### The first two steps

```bash
kubectl apply -f bootstrap/namespaces.yml
kubectl apply -f bootstrap/argocd-app-of-apps.yml
```

This part was smooth. The namespaces were created, the App of Apps registered, and ArgoCD started pulling the `Application` objects from the `apps/` directory. Within seconds all five apps showed up on the watch: `cert-manager`, `cnpg-operator`, `nextcloud`, `immich`, `jellyfin`. All `Progressing`.

### cnpg-operator stuck OutOfSync

The first problem was `cnpg-operator` getting stuck in `OutOfSync` after a few minutes. The error from `kubectl describe`:

```
CustomResourceDefinition "clusters.postgresql.cnpg.io" is invalid:
metadata.annotations: Too long: may not be more than 262144 bytes
```

CNPG's CRDs are too large to fit in the `last-applied-configuration` annotation that kubectl uses by default — a known issue I found while researching. The fix is adding `ServerSideApply=true` to the syncOptions in `apps/cnpg-operator.yml` and syncing through the ArgoCD UI (Sync → Server-Side Apply, without checking Force, since `--force` and `--server-side` are mutually exclusive). After a few minutes the operator came up as `Synced/Healthy`.

### PVCs that wouldn't bind

With the namespaces created, I applied the PVCs:

```bash
kubectl apply -f charts/nextcloud/pvc.yml
kubectl apply -f charts/immich/pvc.yml
kubectl apply -f charts/jellyfin/pvc.yml
```

Two stayed `Pending`. `immich-pvc` requested 200Gi but the PV had 100Gi declared. Kubernetes won't bind when the PVC asks for more than the PV offers. Simple fix: correct the PVC to 100Gi.

`jellyfin-media-pvc` was missing `storageClassName: ""` in the manifest, so it inherited the cluster's default StorageClass (`local-path`) instead of binding to the PV, which had an explicit empty field. Fix: add the field to the PVC.

### The death of the Bitnami images

Nextcloud's Helm chart uses a Bitnami PostgreSQL subchart. The problem: the `bitnami/postgresql` images with named tags like `16-debian-12` no longer exist on Docker Hub. Bitnami moved to a paid image model. The cluster sat in `ImagePullBackOff` with no way out.

The fix was moving Nextcloud's database to CNPG too, same as Immich. I created a `charts/nextcloud/postgres-cluster.yml` with a CNPG Cluster, disabled the Bitnami subchart in `values.yml`, and enabled `externalDatabase` pointing to the CNPG service.

But the Nextcloud chart always generates an init container that tries to resolve the host `nextcloud-postgresql` before starting, regardless of whether you've enabled an external database or not. The fix was creating an `ExternalName` Service that redirects that name to CNPG:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: nextcloud-postgresql
  namespace: nextcloud
spec:
  type: ExternalName
  externalName: nextcloud-postgres-rw.nextcloud.svc.cluster.local
```

### Immich's Postgres image incompatible with CNPG

The Immich `postgres-cluster.yml` was using `ghcr.io/immich-app/postgres:17-vectorchord0.4.3-pgvectors0.4.0`. Two problems: the tag no longer existed, and Immich's image doesn't have the UID 26 that the CNPG operator requires to bootstrap the database.

The fix was switching to the `ghcr.io/tensorchord/cloudnative-vectorchord:17-0.3.0` image, which is built specifically to run with CNPG and already has the correct UIDs and the vectorchord extensions available.

Even with the right image, the extensions still had to be created manually as superuser after the database came up, since the `immich` user doesn't have permission to do that:

```bash
kubectl exec -it immich-postgres-1 -n immich -- psql -U postgres -d immich -c "CREATE EXTENSION IF NOT EXISTS vchord CASCADE;"
kubectl exec -it immich-postgres-1 -n immich -- psql -U postgres -d immich -c "CREATE EXTENSION IF NOT EXISTS cube CASCADE;"
kubectl exec -it immich-postgres-1 -n immich -- psql -U postgres -d immich -c "CREATE EXTENSION IF NOT EXISTS earthdistance CASCADE;"
```

### NFS root\_squash blocking everything

Immich came up, connected to the database, ran the migrations, and then:

```
Failed to create /data/encoded-video/.immich: Error: EACCES: permission denied
```

Jellyfin:

```
Access to the path '/config/log' is denied.
```

Same issue as UpSnap on the Pi4. TrueNAS exports NFS with `root_squash` enabled by default, which maps UID 0 to `nobody`. The pods ran as root, TrueNAS blocked the write. Fix: on each service's NFS share in TrueNAS, set **Maproot User: root** and **Maproot Group: root**. After that, a pod restart and everything wrote normally.

### The bjw-s common library and the ignored env vars

Immich's chart uses the `bjw-s common library`. I had the environment variables at the root level of `values.yml`:

```
env:
  DB_HOSTNAME: immich-postgres-rw
```

Those variables were simply ignored. The server started up trying to connect to a host called `database`, the hardcoded default. The correct structure for bjw-s is:

```
controllers:
  main:
    containers:
      main:
        env:
          DB_HOSTNAME: immich-postgres-rw
```

After that change the server connected to the database for the first time.

### Nextcloud killed by the liveness probe

On first startup, Nextcloud needs to create all its database tables. That takes longer than the liveness probe's default. Kubernetes was killing the container before it finished initializing, the pod went into `CrashLoopBackOff`, and it never managed to finish setup.

Fix: increase `initialDelaySeconds` to 120 and `failureThreshold` to 10 on Nextcloud's probes. On the next attempt the container came up and Nextcloud initialized correctly.

##  TLS and DNS

With all services `Healthy`, external access was still missing. cert-manager's `ClusterIssuer` was created, but the challenges stayed stuck in `pending` for hours. The reason: I created the `ClusterIssuer` before creating the `cloudflare-api-token` secret. cert-manager couldn't authenticate with Cloudflare to create the validation TXT record.

Fix: create the secret and delete the old challenges to force re-issuance:

```bash
kubectl delete challenge -n nextcloud nextcloud-tls-1-...
kubectl delete challenge -n immich immich-tls-1-...
kubectl delete challenge -n jellyfin jellyfin-tls-1-...
```

Within a few minutes all three certificates turned `Ready: True`.

For DNS, I created A records on Cloudflare pointing to the k3s-node's Tailscale IP, all with the proxy disabled (DNS only). The Tailscale IP isn't publicly routable, so in practice only someone on my Tailscale network can actually reach it, even though the name resolves for anyone who queries the DNS.

The last detail was Tailscale's MagicDNS intercepting the DNS queries. Enabling **Override DNS servers** in the Tailscale admin panel with Cloudflare as the global nameserver made the problem disappear, and all three domains started resolving correctly.

##  Final state

| App | Status | Address |
| --- | --- | --- |
| `cert-manager` | Synced / Healthy | — |
| `cnpg-operator` | Synced / Healthy | — |
| `nextcloud` | Synced / Healthy | nextcloud.homelab.luisbrancher.dev |
| `immich` | Synced / Healthy | immich.homelab.luisbrancher.dev |
| `jellyfin` | Synced / Healthy | jellyfin.homelab.luisbrancher.dev |

TLS issued via Let's Encrypt for all three. Access via Tailscale from any device on my network.

##  What's still pending

Not everything wrapped up in this session. `immich-nextcloud-photos-pvc` is created and bound, but not yet mounted in the Immich pod. Still need to add `extraVolumes` and `extraVolumeMounts` to `values.yml` and configure the path as an External Library in the UI. Jellyfin is also up but with no content: the media files need to be uploaded via SFTP to `/mnt/media` on the k3s-node, which is where the `hostPath` PVC points.

Those are the next steps. For now, what matters is going from zero to everything healthy on a real cluster, with dedicated storage, automatic TLS, and GitOps working. Any config change from here is a git push.

The code is on [homelab-gitops](https://github.com/luisbrancher/homelab-gitops) and the infrastructure on [homelab-infra](https://github.com/luisbrancher/homelab-infra).
