const { assert } = require('chai')
const { GraphBuilder } = require('../src/graphBuilder')
const { Graph, Node, Link } = require('../src/graph')

describe('graph', function () {

    it('should build a basic graph by connecting nodes and links', () => {
        const [graph] = new GraphBuilder()
            .add({
                name: 'A',
                value: 200,
                links: [{
                    to: 'B',
                    value: 300,
                }]
            })
            .build()

        assert.instanceOf(graph, Graph)
        assert.lengthOf(graph.nodes, 2)
        assert.instanceOf(graph.nodes[0], Node)
        assert.instanceOf(graph.nodes[1], Node)
        assert.lengthOf(graph.links, 1)
        assert.instanceOf(graph.links[0], Link)
        assert.equal(graph.links[0].sourceNode, graph.nodes[0])
        assert.equal(graph.links[0].targetNode, graph.nodes[1])
    })

    it('should clone a graph', () => {
        const [originalGraph] = new GraphBuilder()
            .add({
                name: 'A',
                value: 200,
                links: [{
                    to: 'B',
                    value: 300,
                }]
            })
            .build()

        const clone = originalGraph.clone()
        assert.equal(clone.nodes.length, originalGraph.nodes.length)
        for (const [i, node] of clone.nodes.entries()) {
            assert.instanceOf(node, Node)
            assert.notEqual(node, originalGraph.nodes[i])
        }

        assert.equal(clone.links.length, originalGraph.links.length)
        for (const [i, link] of clone.links.entries()) {
            assert.instanceOf(link, Link)
            assert.notEqual(link, originalGraph.links[i])
        }
    })
})
