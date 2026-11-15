---
title: "Redesigning my homelab #03: GitOps with ArgoCD and code planning"
description: "How I structured the repository and cluster with ArgoCD to manage the entire homelab declaratively and automatically."
date: 2026-04-20
readingTime: 7
tags: ["GITOPS", "ARGOCD", "KUBERNETES", "IAC", "HOMELAB"]
repo: "https://github.com/luisbrancher/homelab-gitops"
translationKey: "gitops"
---
When I decided to rebuild my homelab from scratch with IaC, the goal was clear: no SSH to spin up services, no "let me try to remember what I ran here". Terraform to provision VMs in Proxmox, Ansible to configure the operating system, k3s to orchestrate the containers, and ArgoCD to close the cycle. Everything declarative, everything in git.

This last part, ArgoCD, was where I spent the most time thinking before writing any code. Since it was my first experience with this kind of tool, I needed to understand a bit about folder structure and how to organize things to run smoothly.

Because I am currently traveling, I am writing all the IaC code so that my new homelab is ready when I return home, having only to install the bootstrap and run the commands. I already have a post here about the hardware and how I used Terraform to provision it ([here](../novo-homelab-01/)). All the Ansible configuration part is also detailed ([here](../novo-homelab-02/)). In this article, I explain how to configure k3s with ArgoCD and, when I return home, I'll likely create a post/video running the code and doing troubleshooting.

##  The problem ArgoCD solves

After Ansible finishes its job and k3s goes up, you have a functional but empty cluster. The honest question is: how do I put my services there in a way that I can reproduce and understand six months from now?

I could use `helm install` via the command line, but that would just be trading a "manual Docker" for a "manual Kubernetes". I wanted a real declarative state. If the cluster explodes tomorrow, I don't want to have to remember anything.

With GitOps, you invert the logic: instead of pushing changes to the cluster, you declare how you want things to be in Git, and ArgoCD manages to ensure the cluster reflects it. The source of truth leaves the terminal and moves to the repository.

In practice: git push updates the service. Did it error out? Revert the commit and the service goes back to its previous state. Want to know what's running? Just look at the repo.

##  App of Apps: managing the manager

ArgoCD works with an object called `Application`: each represents a service and says where the chart comes from, how to configure it, and where to install it. But who creates these `Application` objects?

If you create them manually, you lose part of the benefit. The solution is the **App of Apps** pattern: a special `Application` that points to the `apps/` directory in the repository. ArgoCD monitors this directory, and any `.yaml` file that appears there automatically becomes a new managed service.

You apply this bootstrap **only once**, manually:

```bash
kubectl apply -f bootstrap/argocd-app-of-apps.yaml
```

After that, adding a new service is just creating `apps/new-service.yaml` and doing a `git push`. ArgoCD detects and syncs it.

This was one of the things that clicked the most for me during the process. The elegance lies in having a single entry point that unfolds everything else.

##  The final structure

After a lot of iterations, the `homelab-gitops` repository ended up like this:

```
homelab-gitops/
├── bootstrap/          # applied once, manually
├── apps/               # ArgoCD monitors this directory
├── charts/             # values.yaml + PVCs per service
└── config/             # configurations that are not services
    └── cert-manager/
```

Each service has its folder in `charts/` with two files: `values.yaml` to configure the Helm chart, and `pvc.yaml` to declare the storage. The `apps/` folder only holds the ArgoCD manifests, lightweight, with no business configuration.

The separation seems obvious once done, but it took a while to understand why it exists. The `apps/nextcloud.yaml` answers "how to deploy". The `charts/nextcloud/values.yaml` answers "how Nextcloud should behave". They are different responsibilities.

##  Real doubts I had

**One Helm release per service?**

Yes. The temptation to group related services in a single release is real, but isolation pays off. A failure in Immich doesn't affect Nextcloud. Granular rollback. Clean diff in git. It's worth the verbosity.

**.yaml or .yml?**

Zero technical difference. The Kubernetes ecosystem convention is `.yaml`, so that's it.

**Does every YAML file start with ---?**

It's not mandatory in a file with a single document, but it's good practice. In files with multiple resources — like `pvc.yaml` which holds a PV and a PVC together, the `---` separating each object is mandatory. Using it in all files solves the problem of having to think about it on a case-by-case basis.

**Where does the Cloudflare API token go?**

This was the one that generated the most doubt. The answer is: never in git. The cert-manager `ClusterIssuer` only references the name of a Secret, the real value you apply via CLI:

```bash
kubectl create secret generic cloudflare-api-token \
  --namespace cert-manager \
  --from-literal=api-token=YOUR_TOKEN
```

The same goes for Nextcloud credentials, Immich, or anything sensitive. The file that stays in the repo is a placeholder documenting the Secret's structure, without any real value.

In the future this will evolve to SOPS: you encrypt the file before committing, and then you can version it safely. But for now, CLI solves it and is honest about the project's current stage.

**Does cert-manager know the configuration is in config/cert-manager/?**

Not automatically. ArgoCD only monitors `apps/`. The `ClusterIssuer` and the Cloudflare Secret you apply manually — just like the bootstrap. It's a justified exception: these are resources you configure once and rarely change.

##  Order matters

One thing I learned: the deployment order is not trivial when services have dependencies.

Cert-manager needs to be healthy before creating the `ClusterIssuer`. The `ClusterIssuer` needs to exist before any Ingress with the `cert-manager.io/cluster-issuer` annotation. PVCs need to exist before the pods that mount them.

The sequence that worked:

```
namespaces → App of Apps → cert-manager healthy
→ PVCs → ClusterIssuer → Secrets
→ git push of other services
```

ArgoCD has a mechanism called **sync waves** to automate this ordering — an annotation that defines in which "wave" each resource should be created. It's the natural next step, but not necessary to get started.

##  What stays out of the repo

Three categories of things that do not go into `homelab-gitops`:

- **Secrets** — sensitive values always via CLI
- **Infrastructure** — VMs, networking, physical storage stay in `homelab-infra` (Terraform + Ansible)
- **Application configuration** — Immich's External Library pointing to the Nextcloud photo directory, for example, you configure via the UI. There is no way to declare this in YAML.

That last category bothered me at first. It seems to break the "everything declarative" motto. But it makes sense to accept it: GitOps manages the state of the cluster's infrastructure, not the internal state of the application.

##  What comes next

The repo is functional, but there's room to evolve:

- **SOPS** to encrypt secrets and version them safely
- **Sync waves** to automate deployment order
- **External Secrets Operator** to fetch secrets from an external vault
- **Staging environment** — a separate namespace to test changes before applying them to production

None of this is necessary right now. What exists is already real GitOps: state declared in git, automatic reconciliation, complete history of changes.

If the cluster dies tomorrow, I know exactly what needs to run to get it back up. And that, ultimately, was the goal.

### 💡 Summary

The cluster repository is open at [github.com/luisbrancher/homelab-gitops](https://github.com/luisbrancher/homelab-gitops). The infrastructure that provisions the cluster from bare metal is detailed in the [homelab-infra](https://github.com/luisbrancher/homelab-infra) repository.
