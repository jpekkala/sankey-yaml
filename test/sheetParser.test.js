const { assert } = require('chai')
const {
    parseSingleSheet,
    parseSheet,
    parseSheetAsync,
} = require('../src/sheetParser')

describe('sheetParser', function() {

    it('should autovivify missing nodes from links', () => {
        const yaml = `
        nodes:
            - name: Parent
              links:
                - { to: Child, value: 1000, description: 'Description' }
        `
        const { nodes } = parseSingleSheet(yaml)
        assert.lengthOf(nodes, 2)
        assert.equal(nodes[0].name, 'Parent')
        assert.equal(nodes[1].name, 'Child')
        assert.equal(nodes[1].description, 'Description')
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

    it('should embed subsheets', async () => {
        const yaml = `
        nodes:
            - name: A
              links:
                - { to: B }
        embed:
            - B.yaml`

        const sheetB = `
        nodes:
            - name: B
              links:
                - { to: C }
        embed:
            - C.yaml`

        const sheetC = `
        nodes:
            - name: C
              value: 100
              links:
                - { to: D, value: 200 }`

        const files = {
            'B.yaml': sheetB,
            'C.yaml': sheetC,
        }

        const graphsSync = parseSheet(yaml, {
            getFile: fileName => files[fileName]
        })
        assert.lengthOf(graphsSync, 1)
        const { nodes } = graphsSync[0]
        assert.lengthOf(nodes, 4)
        assert.equal(nodes[0].name, 'A')
        assert.equal(nodes[1].name, 'B')
        assert.equal(nodes[2].name, 'C')
        assert.equal(nodes[3].name, 'D')

        const graphsAsync = await parseSheetAsync(yaml, {
            getFile: fileName => files[fileName]
        })
        assert.deepEqual(graphsSync, graphsAsync, 'The sync and async variants should return the same result')
    })

    it('should translate sheets', () => {
        const yaml = `
        title: Sheet
        nodes:
            - name: Cat
              links:
                - { to: Dog }
        translations:
            fi: finnish.json`

        const files = {
            'finnish.json': '{ "Cat": "Kissa", "Dog": "Koira" }'
        }

        const graphs = parseSheet(yaml, {
            getFile: fileName => files[fileName]
        })
        assert.lengthOf(graphs, 2)
        assert.equal(graphs[0].title, 'Sheet')
        assert.equal(graphs[1].title, 'Sheet_fi')

        assert.equal(graphs[0].nodes[0].name, 'Cat')
        assert.equal(graphs[0].nodes[1].name, 'Dog')
        assert.equal(graphs[1].nodes[0].name, 'Kissa')
        assert.equal(graphs[1].nodes[1].name, 'Koira')

        assert.equal(graphs[1].links[0].source, 'Kissa')
        assert.equal(graphs[1].links[0].target, 'Koira')
    })
})
