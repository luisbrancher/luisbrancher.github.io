---
title: "From ClickOps to Code: My First IaC with Terraform on AWS"
description: "How I built my personal website's infrastructure from scratch with Terraform, moving from the AWS console to a modular, secure approach."
date: 2026-03-27
readingTime: 8
tags: ["TERRAFORM", "AWS", "IAC", "SECURITY", "DEVOPS"]
repo: "https://github.com/luisbrancher/personal-site-infra"
translationKey: "iac-terraform"
---
I am traveling and decided to use the time to build my personal website's infrastructure from scratch using Terraform. Not just "spinning up a server," but doing it right: as code, securely, without credentials exposed on the notebook. This article documents this journey over two days of work. From the first line of HCL to a modular infrastructure, with its own VPC, least-privilege IAM, and hardening from boot.

##  Day 01 — Leaving the console and writing the first code

My first instinct was to open the AWS console and click on everything. It's the easiest path. But the starting point of the project was exactly that: to stop doing ClickOps and treat infrastructure as code.

I chose Terraform with a remote backend on HCP Terraform. Practical reason: I am traveling, on different networks every week. It makes no sense to keep the `.tfstate` on disk — it would get outdated or exposed. On HCP, the state is encrypted in the cloud and accessible from anywhere.

### The initial structure

The first code was all in a single `main.tf`. IAM, EC2, Security Group, SSH key — all together. It worked, but you could already tell it wouldn't scale.

Identity was the first point of attention. Instead of using the root account (which should never be used for day-to-day operations), I created a provisioning group with restricted permissions and an operational user linked to it.

The problem? In this first version, I was generating the access keys inside Terraform itself and exposing them in the output:

```hcl
# BAD PRACTICE - REVIEW
resource "aws_iam_access_key" "user_key" {
  user = aws_iam_user.terraform_user.name
}

output "secret_access_key" {
  value     = aws_iam_access_key.user_key.secret
  sensitive = true
}
```

I even marked it as `# BAD PRACTICE` in the code. The problem isn't just exposing it in the terminal — it's the fact that credentials generated via Terraform get saved in the `.tfstate`. Even with `sensitive = true`, they are there, in plaintext, in the state file. This was fixed the next day.

### EC2, SSH, and the first server

For the instance, I chose Debian 13 on the ARM64 architecture (t4g.micro). The combination of free tier with ARM is already used in production by serious companies and is also more economical than an x86 instance, but it's not just about savings, it's a defensible technical choice.

The SSH key pair was injected via Terraform using ED25519, which is more secure and compact than RSA. The public key goes to the server at the time of creation. The private key stays only on my notebook, protected by a password.

With `terraform apply`, the entire structure that would take 15 minutes in the console was ready in less than 60 seconds. This was the first moment when IaC stopped being a concept and became practice.

This was the code at the end of the first day:

```hcl
# main.tf
terraform {
  # define location for .tfstate
  cloud {
    organization = "lfck" # state storage in HCP Terraform

    workspaces {
      name = "aws-debian-site"
    }
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  required_version = ">= 1.2.0"
}

# creates a group for the terraform user
resource "aws_iam_group" "terraform_group" {
  name = "terraform-provisioners-group"
}

# creates the terraform user
resource "aws_iam_user" "terraform_user" {
  name = "terraform-operator"

  tags = {
    Environment = "Prod"
    Project     = "MySite"
  }
}

# add terraform user to terraform group
resource "aws_iam_group_membership" "terraform_team" {
  name = "terraform-membership"

  users = [
    aws_iam_user.terraform_user.name
  ]

  group = aws_iam_group.terraform_group.name
}

# defines group policies (ec2 + vpc)
resource "aws_iam_group_policy_attachment" "ec2_access" {
  group      = aws_iam_group.terraform_group.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2FullAccess"
}

resource "aws_iam_group_policy_attachment" "vpc_access" {
  group      = aws_iam_group.terraform_group.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonVPCFullAccess"
}

# generates access key - BAD PRACTICE - REVIEW
resource "aws_iam_access_key" "user_key" {
  user = aws_iam_user.terraform_user.name
}

# key output - BAD PRACTICE - REVIEW
output "access_key_id" {
  value     = aws_iam_access_key.user_key.id
  sensitive = true # doesn't show in terminal
}

# key output - BAD PRACTICE - REVIEW
output "secret_access_key" {
  value     = aws_iam_access_key.user_key.secret
  sensitive = true # doesn't show in terminal
}

# set AWS provider
provider "aws" {
  region = "sa-east-1" # AZ Region
}

# creates SSH key pair
resource "aws_key_pair" "chave_ssh" {
  key_name   = "chave-debian-server"
  public_key = file("~/.ssh/id_ed25519.pub")
}

# Security Group to allow site traffic
resource "aws_security_group" "web_sg" {
  name        = "web_server_dev_sg"
  description = "Secure access for .dev domain"

  # HTTPS for .dev
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # SSH
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # server can access the web
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# create EC2 instance
resource "aws_instance" "server_debian" {
  # Debian 13 arm64 architecture AMI in sa-east-1 region
  ami           = "ami-0acd214583e63a88e"
  instance_type = "t4g.micro" # Free Tier (Arm architecture)

  vpc_security_group_ids = [aws_security_group.web_sg.id]  # assigns SG to the instance
  key_name               = aws_key_pair.chave_ssh.key_name # assigns SSH key

  # tag to facilitate identification
  tags = {
    Name        = "Instancia-Debian-13-T4g"
    Environment = "Dev"
  }
}

# Displays the public IP of the instance after creation
output "ip_publico" {
  description = "Public IP address of the EC2 instance"
  value       = aws_instance.server_debian.public_ip
}
```

##  Day 02 — From "it works" to "secure and sustainable"

On the second day, the goal changed. It was no longer "make it work" — it was thinking like someone in the field: what am I exposing? who has access? what could go wrong?

### Modular structure

The first thing was to break `main.tf` into files organized by responsibility:

- `provider.tf` → provider and backend configuration
- `iam.tf` → users, groups, and policies
- `network.tf` → VPC, subnet, gateway, routes
- `ec2.tf` → instance definition
- `variables.tf` → reusable values
- `outputs.tf` → post-apply outputs

It seems obvious, but it makes a difference in practice. When I needed to tweak the IAM policy, I only opened `iam.tf`. When I wanted to change the region, I changed the variable in just one place.

### Own VPC: Security by Design

In the first version, the instance used the default AWS VPC. It works, but it's not what you want in an environment that will host a real website. The default VPC was created for convenience, not for security.

I created my own VPC with a public subnet, Internet Gateway, and explicit route table. The complete chain in code:

```hcl
resource "aws_vpc" "main_vpc" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
}

resource "aws_subnet" "public_subnet" {
  vpc_id     = aws_vpc.main_vpc.id
  cidr_block = "10.0.1.0/24"
}

resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.main_vpc.id
}

resource "aws_route_table" "public_rt" {
  vpc_id = aws_vpc.main_vpc.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }
}
```

The Security Group was linked to this VPC, and the instance was placed in the subnet. Everything explicitly connected, without relying on defaults that I don't control.

### Least-privilege IAM — and a financial lock

In v1 I had used `AmazonEC2FullAccess`. It's the shortcut every tutorial shows. The problem is that it gives much more power than necessary — and unnecessary power is an attack surface.

I refactored it into a custom policy with exactly the actions Terraform needs: create and destroy instances, manage Security Groups, create key pairs, describe resources. Nothing more.

The most interesting detail was adding an explicit `Deny` for instance types outside the free tier:

```
      {
        Sid      = "DenyNonFreeTierInstances"
        Effect   = "Deny"
        Action   = "ec2:RunInstances"
        Resource = "arn:aws:ec2:*:*:instance/*"
        Condition = {
          StringNotEquals = {
            "ec2:InstanceType" = "t4g.micro"
          }
        }
      }
```

The difference between a restrictive `Allow` and an explicit `Deny` is important: the Deny always wins, regardless of any other policy attached to the user. If tomorrow someone mistakenly adds a broader policy to the group, this lock still holds. It's defense in depth at the IAM level.

### Hardening from boot

Instead of spinning up the instance and configuring SSH later, I put the hardening directly into `user_data`. The server is born configured:

```
user_data = <<-EOF
  #!/bin/bash
  set -e
  sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/' /etc/ssh/sshd_config
  sed -i 's/^#\?PermitRootLogin .*/PermitRootLogin no/' /etc/ssh/sshd_config
  sed -i 's/^#\?PubkeyAuthentication .*/PubkeyAuthentication yes/' /etc/ssh/sshd_config
  systemctl restart ssh || systemctl restart sshd
EOF
```

Password login: blocked. Root: blocked. Authentication: key only. There's no "I'll configure it later" — it's already born like this.

### Open SSH: a conscious decision, not an oversight

The Security Group still accepts SSH from any IP (0.0.0.0/0). It looks like a problem — and it would be, if it were ignorance. But it's a temporary decision documented in the code:

\# Migrate to tailscale | using global because I coded while traveling and didn't have a static IP

The strategy is in two stages. Phase 1: SSH open for initial bootstrap, with access protected by an ED25519 key and root blocked. Phase 2: install Tailscale via Ansible, close port 22, and move access to the private network. Public access ceases to exist.

### Global variables and tags

The last adjustment was extracting the values that could change into a `variables.tf` — region, instance type, project name. Without this, any change turns into a hunt for values scattered across multiple files.

Combined with `default_tags` in the provider, the `ManagedBy`, `Project`, and `Owner` tags are automatically applied to all resources without repetition:

```hcl
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      ManagedBy = "terraform"
      Project   = "mywebsite.dev"
      Owner     = "luisfuck"
    }
  }
}
```

The `ManagedBy = "terraform"` tag has a clear practical value: when you open the AWS console six months from now, you immediately know you can't go around changing that resource manually without breaking the state.

##  Technical highlights of the evolution

| File | Change | Why it matters |
| --- | --- | --- |
| `ec2.tf` | Data source for AMI | Always fetches the latest version of Debian 13 ARM. No hardcoded AMI that breaks over time. |
| `ec2.tf` | Hardening via user\_data | Server is born configured. No manual post-deploy steps. |
| `network.tf` | Custom VPC | Real isolation. Without relying on the default VPC that any account resource shares. |
| `iam.tf` | Custom policy with Deny | Moved from FullAccess to least privilege. The Deny for expensive instance types is a lock that cannot be overwritten by other policies. |
| `iam.tf` | No access keys in code | Credentials generated via Terraform remain in plaintext in the .tfstate. Created manually and stored in HCP as sensitive variables. |
| `variables.tf` | Extracted values | Region, instance type, project name. One place to change, affects all files. |

##  Next steps

- Provision the server via `Ansible` — install Tailscale, configure nginx, SSL certificate for the .dev domain
- Close port 22 and move access to the private network via Tailscale
- Evolve IAM — migrate to IAM Identity Center and eliminate long-lived access keys
- Explore OIDC for keyless authentication in pipelines

### 💡 Takeaways

The biggest change wasn't technical. It was to stop thinking "how do I make this work?" and start thinking "how do I do this in a secure and sustainable way?". This changes what you write, what you question, and what you annotate in the code when you know a decision is temporary.

Infrastructure is now ephemeral: I can destroy and rebuild it from anywhere in the world with a single command. This, more than any specific feature, is the point of IaC.

##  Complete Code

Since the code has changed since this article was written, you can check out the final and updated version directly in the official repository:

[💻 View repository on GitHub](https://github.com/luisbrancher/personal-site-infra)
