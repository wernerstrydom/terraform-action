# Terraform GitHub Action

This GitHub Action enables the running of various Terraform commands within GitHub workflows. It supports operations 
such as initialization, workspace selection, format checking, validation, planning, applying, and 
destroying infrastructure as code which is defined using Terraform.

This workflow is based on the [Typescript Action](https://github.com/actions/typescript-action). 

## Usage

### Pre-requisites

Create a workflow `.yml` file in your repositories `.github/workflows` directory. An [example workflow](#examples) is available below.

### Inputs

| Input               | Description                                                                | Required | Default   |
|---------------------|----------------------------------------------------------------------------|----------|-----------|
| `working-directory` | The directory containing the Terraform configuration files                 | No       | `.`       |
| `command`           | The Terraform command to run, which can be either plan, apply, or destroy. | Yes      |           |
| `workspace`         | The Terraform workspace to use                                             | No       | `default` |
| `check-format`      | Whether to check the format of the Terraform configuration files           | No       | `false`   |
| `validate-module`   | Whether to validate the Terraform configuration files                      | No       | `true`    |

### Outputs

| Output       | Description                                    |
|--------------|------------------------------------------------|
| `to-add`     | The number of resources that will be added     |
| `to-change`  | The number of resources that will be changed   |
| `to-destroy` | The number of resources that will be destroyed |
| `to-import`  | The number of resources that will be imported  |

The action will also output outputs from Terraform. For example, if you have an output in your Terraform configuration
called `hostname`, it will have an output `terraform-hostname` and you can access it in the workflow using 
`${{ steps.terraform.outputs.hostname }}`.  Complex outputs will be converted to JSON.

## Examples

The following examples assume you have a Terraform configuration in the root of your repository, and that you have
configured the AWS provider. For example, you could have a `main.tf` file with the following contents

```hcl

// Other configuration omitted for brevity

resource "aws_instance" "example" {
  ami           = "ami-1234567890"
  instance_type = "t2.micro"
}

output "hostname" {
  value = aws_instance.example.public_dns
}
```

### Terraform Plan and Apply

Whenever a pull request is opened, synchronized, or reopened, this workflow will run a Terraform plan and apply. It will
also check the format of the Terraform configuration files, and validate the configuration files. The Terraform
configuration files will be loaded from the `ci` workspace, and the AWS credentials will be loaded from GitHub secrets.

This essentially creates an ephemeral environment for each pull request, which is destroyed when the pull request is
closed (see destroy workflow below).

In this workflow, the terraform module will output a string `hostname`, which can then later be used in the workflow
for other purposes, like Ansible provisioning.

```yaml
name: Terraform Plan and Apply

on:
    pull_request:
      types: [opened, synchronize, reopened]
      branches:
        - main

jobs:
    terraform:
        name: Terraform Plan and Apply
        runs-on: ubuntu-latest
        steps:
        - name: Checkout
          uses: actions/checkout@v2
    
        - name: Terraform Plan and Apply
          id: terraform
          uses: phaka/terraform-action@v1-beta
          with:
            command: apply
            workspace: ci-${{ github.repository_owner_id }}-${{ github.repository_id }}-${{ github.event.pull_request.number }}
            check-format: true
            validate-module: true
          env:
            TF_VAR_region: us-east-1
            TF_VAR_access_key: ${{ secrets.AWS_ACCESS_KEY_ID }}
            TF_VAR_secret_key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
            
        - name: Terraform Outputs
          run: |
            echo "The following resources will be added: ${{ steps.terraform.outputs.to-add }}"
            echo "The following resources will be changed: ${{ steps.terraform.outputs.to-change }}"
            echo "The following resources will be destroyed: ${{ steps.terraform.outputs.to-destroy }}"
            echo "The following resources will be imported: ${{ steps.terraform.outputs.to-import }}"
            # echo the hostname which is an output from the Terraform configuration
            echo "The hostname is: ${{ steps.terraform.outputs.terraform-hostname }}"
```

### Terraform Destroy

Whenever a pull request is closed, this workflow will run a Terraform destroy. It will skip the format check and
validation, and will load the Terraform configuration files from the `ci` workspace. The AWS credentials will be loaded
from GitHub secrets.


```yaml
name: Terraform Destroy

on:
  pull_request:
    types: [closed]
    branches:
      - main

jobs:
    terraform:
        name: Terraform Destroy
        runs-on: ubuntu-latest
        steps:
        - name: Checkout
          uses: actions/checkout@v2
    
        - name: Terraform Destroy
          uses: phaka/terraform-action@v1-beta
          with:
            command: destroy
            workspace: ci-${{ github.repository_owner_id }}-${{ github.repository_id }}-${{ github.event.pull_request.number }}
            check-format: false
            validate-module: false
          env:
            TF_VAR_region: us-east-1
            TF_VAR_access_key: ${{ secrets.AWS_ACCESS_KEY_ID }}
            TF_VAR_secret_key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```
