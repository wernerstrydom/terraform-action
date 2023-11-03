import * as core from '@actions/core'
import * as exec from '@actions/exec'

interface TerraformOutput {
  sensitive: boolean
  type: string
  value: unknown
}

interface TerraformOutputs {
  [key: string]: TerraformOutput
}

export async function run(): Promise<void> {
  const workingDirectory =
    core.getInput('working-directory', { required: false }) || '.'
  const workspace = core.getInput('workspace', { required: false }) || 'default'
  const checkFormat =
    core.getInput('check-format', { required: false }) === 'true'
  const validateModule =
    core.getInput('validate-module', { required: false }) === 'true'
  const command = core.getInput('command', { required: true })

  // Terraform Init
  core.startGroup('Terraform Init')
  await exec.exec('terraform', ['init'], { cwd: workingDirectory })
  core.endGroup()

  // Terraform Select Workspace
  if (workspace !== 'default') {
    core.startGroup('Terraform Select Workspace')
    await exec.exec(
      'terraform',
      ['workspace', 'select', '-or-create', workspace],
      { cwd: workingDirectory }
    )
    core.endGroup()
  }

  // Terraform Format
  if (checkFormat) {
    core.startGroup('Terraform Format')
    await exec.exec('terraform', ['fmt', '-check', '-no-color'], {
      cwd: workingDirectory
    })
    core.endGroup()
  }

  // Terraform Validate
  if (validateModule) {
    core.startGroup('Terraform Validate')
    await exec.exec('terraform', ['validate', '-no-color'], {
      cwd: workingDirectory
    })
    core.endGroup()
  }

  if (command === 'plan' || command === 'apply') {
    core.startGroup('Terraform Plan')
    // Terraform Plan
    let planOutput = ''
    const options = {
      cwd: workingDirectory,
      listeners: {
        stdout: (data: Buffer) => {
          planOutput += data.toString()
        }
      }
    }

    try {
      await exec.exec(
        'terraform',
        ['plan', '-no-color', '-input=false', '-out=tfplan'],
        options
      )
    } catch {
      core.setFailed('Terraform plan failed.')
      return
    }

    const planResult = parseTerraformPlanOutput(planOutput)
    core.setOutput('to-add', planResult.toAdd)
    core.setOutput('to-change', planResult.toChange)
    core.setOutput('to-destroy', planResult.toDestroy)
    core.setOutput('to-import', planResult.toImport)

    // TODO: Update PR (if applicable)
    await core.summary
      .addHeading('Terraform Plan Output')
      .addCodeBlock(planOutput, 'text')
      .write()

    core.endGroup()
  }

  if (command === 'apply') {
    core.startGroup('Terraform Apply')
    // Terraform Apply
    await exec.exec(
      'terraform',
      ['apply', '-no-color', '-input=false', '-auto-approve', 'tfplan'],
      { cwd: workingDirectory }
    )

    // Get Terraform outputs
    let outputs = ''
    await exec.exec('terraform', ['output', '-json'], {
      cwd: workingDirectory,
      listeners: {
        stdout: (data: Buffer) => {
          outputs += data.toString()
        }
      }
    })
    core.endGroup()

    core.startGroup('Terraform Outputs')
    // Parse the outputs and set them as action outputs
    const parsedOutputs: TerraformOutputs = JSON.parse(outputs)
    for (const [key, output] of Object.entries(parsedOutputs)) {
      if (typeof output === 'object' && output !== null && 'value' in output) {
        const outputName = `terraform-${key}`
        if (
          typeof output.value === 'string' ||
          typeof output.value === 'number' ||
          typeof output.value === 'boolean' ||
          Array.isArray(output.value) ||
          typeof output.value === 'object'
        ) {
          const outputValue = JSON.stringify(output.value)
          core.info(`Setting output ${outputName}`)
          core.setOutput(outputName, outputValue)
        } else {
          core.warning(
            `Output ${key} has unsupported type ${typeof output.value}`
          )
        }
      } else {
        core.warning(`Output ${key} is not in expected format`)
      }
    }

    // Prepare the table data
    const tableHeader = [
      { data: 'Terraform Name', header: true },
      { data: 'Generated Name', header: true },
      { data: 'Type', header: true },
      { data: 'Value', header: true }
    ]

    const tableRows = Object.entries(parsedOutputs).map(([key, output]) => {
      const generatedName = `terraform-${key}`
      const type = typeof output.value // You may need to adjust this for complex types
      const value = output.sensitive ? '*****' : JSON.stringify(output.value)
      return [key, generatedName, type, value]
    })

    const tableData = [tableHeader, ...tableRows]

    // Write the summary
    await core.summary
      .addHeading('Terraform Outputs')
      .addTable(tableData)
      .write()

    core.endGroup()
  }

  if (command === 'destroy') {
    core.startGroup('Terraform Destroy')
    await exec.exec('terraform', ['destroy', '-no-color', '-auto-approve'], {
      cwd: workingDirectory
    })
    core.endGroup()
  }

  return
}

// This function will parse the output of "terraform plan" and return the counts of changes
export function parseTerraformPlanOutput(output: string): {
  toAdd: number
  toChange: number
  toDestroy: number
  toImport: number
} {
  const addChangeDestroyRegex =
    /(\d+) to add, (\d+) to change, (\d+) to destroy./
  const importRegex = /(\d+) to import,/

  const addChangeDestroyMatches = output.match(addChangeDestroyRegex)
  const importMatches = output.match(importRegex)

  const toAdd = addChangeDestroyMatches
    ? parseInt(addChangeDestroyMatches[1])
    : 0
  const toChange = addChangeDestroyMatches
    ? parseInt(addChangeDestroyMatches[2])
    : 0
  const toDestroy = addChangeDestroyMatches
    ? parseInt(addChangeDestroyMatches[3])
    : 0
  const toImport = importMatches ? parseInt(importMatches[1]) : 0

  return { toAdd, toChange, toDestroy, toImport }
}
