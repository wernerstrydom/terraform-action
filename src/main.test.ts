import { parseTerraformPlanOutput } from './main'

describe('parseTerraformPlanOutput', () => {
  it('should parse terraform output with add, change, and destroy counts', () => {
    const output = 'Plan: 1 to add, 2 to change, 3 to destroy.'
    const result = parseTerraformPlanOutput(output)
    expect(result).toEqual({ toAdd: 1, toChange: 2, toDestroy: 3, toImport: 0 })
  })

  it('should parse terraform output with import, add, change, and destroy counts', () => {
    const output = 'Plan: 4 to import, 1 to add, 2 to change, 3 to destroy.'
    const result = parseTerraformPlanOutput(output)
    expect(result).toEqual({ toAdd: 1, toChange: 2, toDestroy: 3, toImport: 4 })
  })

  it('should return zeros when no matches are found', () => {
    const output = 'No changes. Infrastructure is up-to-date.'
    const result = parseTerraformPlanOutput(output)
    expect(result).toEqual({ toAdd: 0, toChange: 0, toDestroy: 0, toImport: 0 })
  })
})
