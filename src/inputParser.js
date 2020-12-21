const fs = require('fs');
const jsYaml = require('js-yaml')
const d3 = require('d3');
const _ = require('lodash')

const DEFAULT_WIDTH = 800
const DEFAULT_HEIGHT = 600

exports.parseFromYamlFile = function(fileName) {
    const text = fs.readFileSync(fileName, 'utf8')
    return parseYaml(text)
}

function parseYaml(text) {
    const yaml = jsYaml.load(text)
    const yamlNodes = yaml.nodes

    const builder = new GraphBuilder()
    yamlNodes.forEach(node => builder.addNode(node))
    builder.autovivifyNodes()
    builder.linkNodes()
    const graph = builder.build()
    graph.colorNodes()

    return {
        title: yaml.title,
        unit: yaml.unit,
        width: yaml.width || DEFAULT_WIDTH,
        height: yaml.height ||DEFAULT_HEIGHT,
        nodes: graph.nodes.map(node => node.toJSON()),
        links: graph.links.map(link => link.toJSON()),
    }
}
exports.parseYaml = parseYaml

class GraphBuilder {

    constructor() {
        this.nodeMap = new Map()
    }

    addNode(data) {
        this.nodeMap.set(data.name, new Node(data))
    }

    build() {
        this.autovivifyNodes()
        this.linkNodes()
        this.orderNodes()
        return new Graph(this.nodes)
    }

    autovivifyNodes() {
        const missingTargets = this.nodes
            .flatMap(node => node.originalLinks)
            .map(link => link.to)
            .filter(target => !this.nodeMap.has(target))

        for (const target of _.uniq(missingTargets)) {
            this.addNode({
                name: target,
            })
        }
    }

    linkNodes() {
        for (const node of this.nodes) {
            node.incomingLinks = []
        }

        for (const node of this.nodes) {
            node.outgoingLinks = node.originalLinks.map(linkData => {
                const link = new Link({
                    sourceNode: node,
                    targetNode: this.getByName(linkData.to),
                    value: linkData.value,
                })
                link.targetNode.incomingLinks.push(link)
                return link
            })
        }
    }

    orderNodes() {
        const orderedMap = new Map()
        for (const node of this.nodes) {
            recurse(node)
        }
        this.nodeMap = orderedMap

        function recurse(node) {
            if (!orderedMap.has(node)) {
                orderedMap.set(node.name, node)
            }

            for (const link of node.outgoingLinks) {
                recurse(link.targetNode)
            }
        }
    }

    getByName(name) {
        return this.nodeMap.get(name)
    }

    get nodes() {
        return Array.from(this.nodeMap.values())
    }
}


class Graph {

    constructor(nodes) {
        this.nodes = nodes
    }

    colorNodes() {
        const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

        for (const node of this.nodes) {
            colorNode(node)
        }

        function colorNode(node) {
            if (!node.color) {
                const { parent } = node
                if (parent) {
                    colorNode(parent)
                    node.color = parent.color
                } else {
                    node.color = colorScale(node.name)
                }

                if (node.color === 'random') {
                    node.color = colorScale(node.name)
                }
            }
        }
    }

    get links() {
        return this.nodes.flatMap(node => node.outgoingLinks)
    }
}

class Node {
    constructor({ name, description, color, links, value }) {
        this.name = name
        this.description = description
        this.color = color
        this.explicitValue = value
        this.originalLinks = links || []

        // set by GraphBuilder
        this.incomingLinks = []
        this.outgoingLinks = []
    }

    get parent() {
        const link = this.incomingLinks[0]
        return link && link.sourceNode
    }

    get incomingValue() {
        return this.incomingLinks.reduce((sum, link) => {
            return sum + link.value
        }, 0)
    }

    get outgoingValue() {
        return this.outgoingLinks.reduce((sum, link) => {
            return sum + link.value
        }, 0)
    }

    get value() {
        if (this.explicitValue != null) {
            return this.explicitValue
        }
        return this.incomingValue || this.outgoingValue
    }

    toJSON() {
        return {
            name: this.name,
            description: this.description,
            color: this.color,
            value: this.value,
        }
    }
}

class Link {

    constructor({ sourceNode, targetNode, value }) {
        this.sourceNode = sourceNode
        this.targetNode = targetNode
        this.value = value
    }

    get color() {
        return this.targetNode.color || this.sourceNode.color
    }

    toJSON() {
        return {
            source: this.sourceNode.name,
            target: this.targetNode.name,
            color: this.color,
            value: this.value,
        }
    }
}