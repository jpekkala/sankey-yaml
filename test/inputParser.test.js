const { assert } = require('chai')
const { parseYaml } = require('../src/inputParser')

describe('inputParser', function() {

    it('should autovivify missing nodes from links', () => {
        const yaml = `
        nodes:
            - name: Parent
              links:
                - { to: Child, value: 1000 }
        `
        const { nodes, links } = parseYaml(yaml)
        assert.lengthOf(nodes, 2)
        assert.equal(nodes[0].name, 'Parent')
        assert.equal(nodes[1].name, 'Child')
    })

    it('should set parent prop', () => {
        const yaml = `
        nodes:
            - name: Parent
              links:
                - { to: Child, value: 1000 }
        `
        const { nodes, links } = parseYaml(yaml)
        assert.equal(nodes[1].parent, nodes[0])
    })
})