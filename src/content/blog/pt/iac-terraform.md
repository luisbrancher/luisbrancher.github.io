---
title: "Do ClickOps ao código: minha primeira IaC com Terraform na AWS"
description: "Como construí a infraestrutura do meu site pessoal do zero com Terraform, saindo do console da AWS para uma abordagem modular e segura."
date: 2026-03-27
readingTime: 8
tags: ["TERRAFORM", "AWS", "IAC", "SECURITY", "DEVOPS"]
repo: "https://github.com/luisbrancher/personal-site-infra"
translationKey: "iac-terraform"
---
Estou viajando e resolvi aproveitar o tempo pra construir a infraestrutura do meu site pessoal do zero usando Terraform. Não só "subir um servidor", mas fazer isso direito: como código, com segurança, sem credenciais expostas no notebook. Este artigo documenta essa jornada em dois dias de trabalho. Da primeira linha de HCL até uma infraestrutura modular, com VPC própria, IAM com privilégio mínimo e hardening desde o boot.

##  Dia 01 — Sair do console e escrever o primeiro código

Meu primeiro instinto foi abrir o console da AWS e clicar em tudo. É o caminho mais fácil. Mas o ponto de partida do projeto era justamente esse: parar de fazer ClickOps e tratar infraestrutura como código.

Escolhi o Terraform com backend remoto no HCP Terraform. Motivo prático: estou em viagem, em redes diferentes toda semana. Não faz sentido manter o `.tfstate` no disco — ele ficaria desatualizado ou exposto. No HCP, o estado fica criptografado na nuvem e acessível de qualquer lugar.

### A estrutura inicial

O primeiro código foi tudo num único `main.tf`. IAM, EC2, Security Group, chave SSH — tudo junto. Funcionava, mas já dava pra ver que não ia escalar.

A identidade foi o primeiro ponto de atenção. Em vez de usar a conta root (que nunca deveria ser usada pra operações do dia a dia), criei um grupo de provisionamento com permissões restritas e um usuário operacional vinculado a ele.

O problema? Nessa primeira versão, eu estava gerando as access keys dentro do próprio Terraform e expondo no output:

```hcl
# PRATICA RUIM - REVER
resource "aws_iam_access_key" "user_key" {
  user = aws_iam_user.terraform_user.name
}

output "secret_access_key" {
  value     = aws_iam_access_key.user_key.secret
  sensitive = true
}
```

Eu mesmo marquei como `# PRATICA RUIM` no código. O problema não é só expor no terminal — é o fato de que credenciais geradas via Terraform ficam gravadas no `.tfstate`. Mesmo com `sensitive = true`, estão lá, em texto, no arquivo de estado. Isso foi corrigido no dia seguinte.

### EC2, SSH e o primeiro servidor

Para a instância, escolhi Debian 13 na arquitetura ARM64 (t4g.micro). A combinação de free tier com ARM já é usada em produção por empresas sérias e também é mais economica que uma nstancia x84, mas não é só economia, é uma escolha técnica defensável.

O par de chaves SSH foi injetado via Terraform usando ED25519, mais seguro e mais compacto que RSA. A chave pública vai pro servidor no momento da criação. A privada fica só no meu notebook, protegida por senha.

Com o `terraform apply`, toda a estrutura que levaria 15 minutos no console ficou pronta em menos de 60 segundos. Isso foi o primeiro momento em que IaC deixou de ser conceito e virou prática.

Esse foi o código ao fim do primeiro dia:

```hcl
terraform {
# main.tf
terraform {
  # define local para o .tfstate
  cloud {
    organization = "lfck" # armazenamento do estado no HCP Terraform

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

# cria um grupo para o user terraform
resource "aws_iam_group" "terraform_group" {
  name = "terraform-provisioners-group"
}

# cria o user terraform
resource "aws_iam_user" "terraform_user" {
  name = "terraform-operator"

  tags = {
    Environment = "Prod"
    Project     = "MeuSite"
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

# define as politicas de gruop (ec2 + vpc)
resource "aws_iam_group_policy_attachment" "ec2_access" {
  group      = aws_iam_group.terraform_group.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2FullAccess"
}

resource "aws_iam_group_policy_attachment" "vpc_access" {
  group      = aws_iam_group.terraform_group.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonVPCFullAccess"
}

# gera a key de acesso - PRATICA RUIM - REVER
resource "aws_iam_access_key" "user_key" {
  user = aws_iam_user.terraform_user.name
}

# output da key - PRATICA RUIM - REVER
output "access_key_id" {
  value     = aws_iam_access_key.user_key.id
  sensitive = true # nao mostra no terminal
}

# output da key - PRATICA RUIM - REVER
output "secret_access_key" {
  value     = aws_iam_access_key.user_key.secret
  sensitive = true # nao mostra no terminal
}

# set AWS provider
provider "aws" {
  region = "sa-east-1" # Região AZ
}

# cria par de chaves para SSH
resource "aws_key_pair" "chave_ssh" {
  key_name   = "chave-debian-server"
  public_key = file("~/.ssh/id_ed25519.pub")
}

# Security Group para liberar o tráfego do site
resource "aws_security_group" "web_sg" {
  name        = "web_server_dev_sg"
  description = "Acesso seguro para dominio .dev"

  # HTTPS para .dev
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
  # AMI do Debian 13 arquitetura arm64 na região sa-east-1
  ami           = "ami-0acd214583e63a88e"
  instance_type = "t4g.micro" # Free Tier (arquitetura Arm)

  vpc_security_group_ids = [aws_security_group.web_sg.id]  # atribui o SG à instância
  key_name               = aws_key_pair.chave_ssh.key_name # atribui a chave SSH

  # tag para facilitar a identificação
  tags = {
    Name        = "Instancia-Debian-13-T4g"
    Environment = "Dev"
  }
}

# Exibe o IP público da instância após a criação
output "ip_publico" {
  description = "Endereço IP público da instância EC2"
  value       = aws_instance.server_debian.public_ip
}
```

##  Dia 02 — De "funciona" para "seguro e sustentável"

No segundo dia o objetivo mudou. Não era mais "fazer funcionar" — era pensar como alguém da área: o que estou expondo? quem tem acesso? o que pode dar errado?

### Estrutura modular

A primeira coisa foi quebrar o `main.tf` em arquivos organizados por responsabilidade:

- `provider.tf` → configuração do provider e backend
- `iam.tf` → usuários, grupos e políticas
- `network.tf` → VPC, subnet, gateway, rotas
- `ec2.tf` → definição da instância
- `variables.tf` → valores reutilizáveis
- `outputs.tf` → saídas pós-apply

Parece óbvio, mas faz diferença na prática. Quando precisei ajustar a política IAM, abri só o `iam.tf`. Quando quis mudar a região, alterei a variável em um lugar só.

### VPC própria: Security by Design

Na primeira versão, a instância usava a VPC default da AWS. Funciona, mas não é o que você quer num ambiente que vai hospedar um site real. A VPC default foi criada pra conveniência, não pra segurança.

Criei uma VPC própria com subnet pública, Internet Gateway e route table explícita. A cadeia completa em código:

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

O Security Group foi vinculado a essa VPC, e a instância foi colocada na subnet. Tudo conectado explicitamente, sem depender de defaults que eu não controlo.

### IAM com privilégio mínimo — e uma trava financeira

Na v1 eu tinha usado `AmazonEC2FullAccess`. É o atalho que todo tutorial mostra. O problema é que ele dá muito mais poder do que o necessário — e poder desnecessário é superfície de ataque.

Refatorei para uma policy custom com exatamente as ações que o Terraform precisa: criar e destruir instâncias, gerenciar Security Groups, criar key pairs, descrever recursos. Nada além disso.

O detalhe mais interessante foi adicionar um `Deny` explícito para instance types fora do free tier:

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

A diferença entre um `Allow` restritivo e um `Deny` explícito é importante: o Deny sempre vence, independente de qualquer outra política anexada ao usuário. Se amanhã alguém adicionar uma política mais ampla ao grupo por engano, essa trava ainda se mantém. É defense in depth no nível do IAM.

### Hardening desde o boot

Em vez de subir a instância e configurar o SSH depois, coloquei o hardening direto no `user_data`. O servidor já nasce configurado:

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

Login por senha: bloqueado. Root: bloqueado. Autenticação: só via chave. Não tem "vou configurar depois" — já nasceu assim.

### SSH aberto: decisão consciente, não descuido

O Security Group ainda aceita SSH de qualquer IP (0.0.0.0/0). Parece um problema — e seria, se fosse ignorância. Mas é uma decisão temporária e documentada no código:

\# Migrar para Tailscale | usando global pois estou em viagem sem IP fixo

A estratégia é em dois tempos. Fase 1: SSH aberto pro bootstrap inicial, com acesso protegido por chave ED25519 e root bloqueado. Fase 2: instalar Tailscale via Ansible, fechar a porta 22, e mover o acesso pra rede privada. O acesso público deixa de existir.

### Variáveis e tags globais

O último ajuste foi extrair os valores que poderiam mudar para um `variables.tf` — região, tipo de instância, nome do projeto. Sem isso, qualquer mudança vira uma caça ao valor espalhado em vários arquivos.

Combinado com `default_tags` no provider, as tags `ManagedBy`, `Project` e `Owner` são aplicadas automaticamente em todos os recursos sem repetição:

```hcl
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      ManagedBy = "terraform"
      Project   = "meusite.dev"
      Owner     = "luisfuck"
    }
  }
}
```

A tag `ManagedBy = "terraform"` tem um valor prático claro: quando você abrir o console da AWS daqui a seis meses, sabe imediatamente que não pode sair alterando aquele recurso manualmente sem quebrar o estado.

##  Destaques técnicos da evolução

| Arquivo | Mudança | Por quê importa |
| --- | --- | --- |
| `ec2.tf` | Data source pra AMI | Sempre pega a versão mais recente do Debian 13 ARM. Sem AMI hardcoded que quebra com o tempo. |
| `ec2.tf` | Hardening via user\_data | Servidor nasce configurado. Sem etapa manual pós-deploy. |
| `network.tf` | VPC própria | Isolamento real. Sem depender da VPC default que qualquer recurso da conta compartilha. |
| `iam.tf` | Policy custom com Deny | Saiu do FullAccess pra least privilege. O Deny para instance types caros é uma trava que não pode ser sobrescrita por outras políticas. |
| `iam.tf` | Sem access keys no código | Credenciais geradas via Terraform ficam no .tfstate em texto. Criadas manualmente e armazenadas no HCP como variáveis sensíveis. |
| `variables.tf` | Valores extraídos | Região, instance type, nome do projeto. Um lugar pra mudar, efeito em todos os arquivos. |

##  Próximos passos

- Provisionar o servidor via `Ansible` — instalar Tailscale, configurar nginx, certificado SSL pro domínio .dev
- Fechar a porta 22 e mover acesso pra rede privada via Tailscale
- Evoluir o IAM — migrar pra IAM Identity Center e eliminar access keys de longa duração
- Explorar OIDC pra autenticação sem chaves em pipelines

### 💡 O que ficou

A maior mudança não foi técnica. Foi parar de pensar "como faço funcionar?" e começar a pensar "como faço isso de forma segura e sustentável?". Isso muda o que você escreve, o que você questiona, e o que você anota no código quando sabe que uma decisão é temporária.

A infraestrutura agora é efêmera: posso destruí-la e reconstruí-la de qualquer lugar do mundo com um único comando. Isso, mais do que qualquer feature específica, é o ponto de IaC.

##  Código completo

Como o código já teve mudanças depois da escrita deste artigo, você pode conferir a versão final e atualizada direto no repositório oficial:

[💻 Acessar repositório no GitHub](https://github.com/luisbrancher/personal-site-infra)
