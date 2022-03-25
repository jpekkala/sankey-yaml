const fs = require('fs');
const jsYaml = require('js-yaml')
const _ = require('lodash')

const {
    Graph,
    Link,
    Node,
} = require('./graph')

const DEFAULT_WIDTH = 800
const DEFAULT_HEIGHT = 600

exports.parseSheetFromFile = function(filename, options) {
    const text = fs.readFileSync(filename, 'utf8')
    return parseSheet(text, options)
}

/**
 * Parses a string containing YAML.
 */
function parseSheet(text, options = {}) {
    const yaml = jsYaml.load(text)
    const yamlNodes = yaml.nodes
    includeSubsheets(yamlNodes, yaml)

    const builder = new GraphBuilder()
    yamlNodes.forEach(node => builder.addNode(node))
    builder.autovivifyNodes()
    builder.linkNodes()
    const graph = builder.build()
    graph.colorNodes()

    const {
        plain = true,
    } = options

    return {
        title: yaml.title,
        unit: yaml.unit,
        width: yaml.width || DEFAULT_WIDTH,
        height: yaml.height ||DEFAULT_HEIGHT,
        nodes: graph.nodes.map(node => plain ? node.toJSON() : node),
        links: graph.links.map(link => plain ? link.toJSON() : link),
    }
}
exports.parseSheet = parseSheet

function includeSubsheets(totalNodes, yamlSheet) {
    for (const filename of (yamlSheet.embed || [])) {
        const text = fs.readFileSync(filename, 'utf8')
        const subsheet = jsYaml.load(text)
        totalNodes.push(...subsheet.nodes)
        includeSubsheets(totalNodes, subsheet)
    }
}

/**
 * Allows a graph to be built node by node so that the resulting graph can then be immutable.
 */
class GraphBuilder {

    constructor() {
        this.nodeMap = new Map()
    }

    addNode(data) {
        if (this.nodeMap.has(data.name)) {
            const existingNode = this.nodeMap.get(data.name)
            existingNode.addLinks(data.links || [])
        } else {
            this.nodeMap.set(data.name, new Node(data))
        }
    }

    build() {
        this.autovivifyNodes()
        this.linkNodes()
        this.orderNodes()
        return new Graph(this.nodes)
        // TODO: Return a list in order to support union syntax
    }

    /**
     * Automatically creates any nodes that haven't been explicitly defined but are referenced by links.
     */
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
                    color: linkData.color,
                    nodeLookup: name => this.getByName(name)
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
