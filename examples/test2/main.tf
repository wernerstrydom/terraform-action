terraform {
  required_version = ">= 1.5.0"
  required_providers {
    random = {
      source  = "hashicorp/random"
      version = ">= 3"
    }
  }
}

provider "random" {}

resource "random_string" "random" {
  length = 8
}

output "random" {
  value = {
    random = random_string.random.result
    field1 = "value1"
    field2 = 123
    field3 = true
  }
}
