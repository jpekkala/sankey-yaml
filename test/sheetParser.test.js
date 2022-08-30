const { assert } = require('chai')
const {
    parseSingleSheet,
    parseSheet,
} = require('../src/sheetParser')

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

    it('should support OR syntax', () => {
        const yaml = `
        nodes:
            - name: A
              value: 1000|2000
              links:
                - { to: B, value: rest }
                - { to: C, value: 500 }
        `

        const graphs = parseSheet(yaml)
        assert.lengthOf(graphs, 2)
        {
            const { nodes } = graphs[0]
            assert.lengthOf(nodes, 3)
            assert.equal(nodes[0].value, 1000)
            assert.equal(nodes[1].value, 500)
            assert.equal(nodes[2].value, 500)
        }

        {
            const { nodes } = graphs[1]
            assert.lengthOf(nodes, 3)
            assert.equal(nodes[0].value, 2000)
            assert.equal(nodes[1].value, 1500)
            assert.equal(nodes[2].value, 500)
        }
    })

    it('should automatically set value for top-level node if missing', () => {
        const yaml = `
        nodes:
            - name: A
              links:
                - { to: B, value: 200 }
                - { to: C, value: 300 }
        `

        const { nodes } = parseSingleSheet(yaml)
        assert.lengthOf(nodes, 3)
        assert.equal(nodes[0].value, 500)
    })

    it('should embed subsheets', () => {
        const yaml = `
        nodes:
            - name: A
              links:
                - { to: B }
        embed:
            - sheetB`

        const subsheet = `
        nodes:
            - name: B
              value: 100
              links:
                - { to: C, value: 200 }`

        const { nodes } = parseSingleSheet(yaml, {
            getSubsheet: sheetName => sheetName === 'sheetB' ? subsheet : null,
        })

        assert.lengthOf(nodes, 3)
        assert.equal(nodes[0].name, 'A')
        assert.equal(nodes[1].name, 'B')
        assert.equal(nodes[2].name, 'C')
    })
})
