const { assert } = require('chai')
const { parseSingleSheet } = require('../src/sheetParser')

describe('sheetParser', function() {

    it('should autovivify missing nodes from links', () => {
        const yaml = `
        nodes:
            - name: Parent
              links:
                - { to: Child, value: 1000 }
        `
        const { nodes, links } = parseSingleSheet(yaml)
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
        const { nodes } = parseSingleSheet(yaml, { plain: false })
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
        const { links } = parseSingleSheet(yaml)
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

        const { links } = parseSingleSheet(yaml)
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
        const { links } = parseSingleSheet(yaml)
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
        const { links } = parseSingleSheet(yaml)
        assert.equal(links[0].value, 300)
        assert.equal(links[1].value, 700)
    })

    it('should throw if sheet contains cycles', () => {
        const yaml = `
        nodes:
            - name: A
              links:
                - { to: B, value: 1000 }
            - name: B
              links:
                - { to: A, value: 1000 }
        `
        try {
            parseSingleSheet(yaml)
            assert.fail()
        } catch (err) {
            assert.equal(err.message, 'Cyclic node: A → B → A')
        }
    })
})
