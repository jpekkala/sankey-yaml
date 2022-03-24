const { assert } = require('chai')
const { parseSheet } = require('../src/sheetParser')

describe('sheetParser', function() {

    it('should autovivify missing nodes from links', () => {
        const yaml = `
        nodes:
            - name: Parent
              links:
                - { to: Child, value: 1000 }
        `
        const { nodes, links } = parseSheet(yaml)
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
        const { nodes } = parseSheet(yaml, { plain: false })
        assert.equal(nodes[1].parent, nodes[0])
    })

    it('should support rest links', () => {
        const yaml = `
        nodes:
            - name: Parent
              value: 1000
              links:
                - { to: Child1, value: 300 }
                - { to: Child2, value: rest }
        `
        const { links } = parseSheet(yaml)
        assert.equal(links[0].value, 300)
        assert.equal(links[1].value, 700)
    })

    it('should support auto links', () => {
        const yaml = `
        nodes:
            - name: Parent
              value: 1000
              links:
                - { to: Child, value: auto }
            - name: Child
              links:
                - { to: Grandchild1, value: 200 }
                - { to: Grandchild2, value: 300 }
        `

        const { links } = parseSheet(yaml)
        assert.equal(links[0].value, 500)
    })

    it('should support transitive auto links', () => {
        const yaml = `
        nodes:
            - name: Parent
              value: 1000
              links:
                - { to: Child1, value: auto }
                - { to: Child2, value: rest }
            - name: Child1
              links:
                - { to: Grandchild, value: auto }
            - name: Grandchild
              links:
               - { to: Grandgrandchild, value: 300 }
        `
        const { links } = parseSheet(yaml)
        assert.equal(links[0].value, 300)
        assert.equal(links[1].value, 700)
    })

    it('should support percentages', () => {
        const yaml = `
        nodes:
            - name: Parent
              value: 1000
              links:
                - { to: Child1, value: '30%' }
                - { to: Child2, value: rest }
        `
        const { links } = parseSheet(yaml)
        assert.equal(links[0].value, 300)
        assert.equal(links[1].value, 700)
    })
})
