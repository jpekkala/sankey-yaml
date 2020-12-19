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
        const { nodes } = parseYaml(yaml)
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
        const { nodes } = parseYaml(yaml)
        assert.equal(nodes[1].parent, nodes[0])
    })

    it('should support rest links', () => {
        const yaml = `
        nodes:
            - name: Parent
              value: 1000
              links:
                - { to: Child1, value: 300 }
                - { to: Child2, value: 'rest' }
        `
        const { links } = parseYaml(yaml)
        assert.equal(links[0].value, 300)
        assert.equal(links[1].value, 700)
    })

    it('should support auto links', () => {
        const yaml = `
        nodes:
            - name: Parent
              value: 1000
              links:
                - { to: Child, value: 'auto' }
            - name: Child
              links:
                - { to: Grandchild1, value: 200 }
                - { to: Grandchild2, value: 300 }
        `

        const { links } = parseYaml(yaml)
        assert.equal(links[0].value, 500)
    })
})