const fs = require('fs');
const jsYaml = require('js-yaml')
const {
    cloneDeep,
    uniq,
} = require('lodash')

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
    for (const nodeData of yamlNodes) {
        builder.addNodeData(nodeData)
    }
    const [graph] = builder.build()
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

class GraphBuilder {

    constructor() {
        this.nodeCollections = [new NodeCollection()]
    }

    addNodeData(data) {
        const { value } = data
        if (typeof value === 'string') {
            const values = value.split('|')
            const alternativeNodes = values.map(value => {
                const clone = cloneDeep(data)
                clone.value = value
            })

            const newCollections = []
            for (const node of alternativeNodes) {
                for (const collection of this.nodeCollections) {
                    newCollections.push(collection.cloneAndAdd(node))
                }
            }
            this.nodeCollections = newCollections
        }

        for (const collection of this.nodeCollections) {
            collection.add(data)
        }
    }

    build() {
        return this.nodeCollections.map(collection => collection.toGraph())
    }
}


/**
 * Collects nodes as plain objects and provides a method to convert them to a finished graph.
 */
class NodeCollection {

    constructor() {
        /**
         * Maps names to node data. The values are plain objects and not Node instances. By storing plain objects, it
         * is easier to deep clone the collection.
         */
        this._map = new Map()
    }

    /**
     * Mutates this instance by adding the given node data.
     */
    add(nodeData) {
        const { name } = nodeData

        if (this._map.has(name)) {
            const existing = this._map.get(name)
            const clone = cloneDeep(existing)
            clone.links.push(...nodeData.links || [])
            this._map.set(name, clone)
        } else {
            this._map.set(name, nodeData)
        }
    }

    clone() {
        const clone = new Map()
        for (const [key, value] of this._map.entries()) {
            clone.set(key, cloneDeep(value))
        }
        return clone
    }

    cloneAndAdd(nodeData) {
        const clone = this.clone()
        clone.add(nodeData)
        return clone
    }

    toNodeMap() {
        const nodeMap = new Map()
        for (const [name, nodeData] of this._map) {
            nodeMap.set(name, new Node(nodeData))
        }
        return nodeMap
    }

    toGraph() {
        const nodeMap = this.toNodeMap()
        autovivifyNodes(nodeMap)
        linkNodes(nodeMap)
        const orderedNodes = toOrderedNodeArray(nodeMap)
        return new Graph(orderedNodes)
    }
}

/**
 * Automatically creates any nodes that haven't been explicitly defined but are referenced by a link in another node.
 */
function autovivifyNodes(nodeMap) {
    const referencedNames = new Set()
    for (const node of nodeMap.values()) {
        for (const link of node.originalLinks) {
            referencedNames.add(link.to)
        }
    }

    for (const nodeName of referencedNames) {
        if (!nodeMap.has(nodeName)) {
            nodeMap.set(nodeName, new Node({
                name: nodeName
            }))
        }
    }
}

function linkNodes(nodeMap) {
    for (const node of nodeMap.values()) {
        node.incomingLinks = []
    }

    for (const node of nodeMap.values()) {
        node.outgoingLinks = node.originalLinks.map(linkData => {
            const link = new Link({
                sourceNode: node,
                targetNode: nodeMap.get(linkData.to),
                value: linkData.value,
                color: linkData.color,
                nodeLookup: name => nodeMap.get(name)
            })
            link.targetNode.incomingLinks.push(link)
            return link
        })
    }
}

function toOrderedNodeArray(nodeMap) {
    const orderedMap = new Map()
    for (const node of nodeMap.values()) {
        recurse(node)
    }
    return [...orderedMap.values()]

    function recurse(node) {
        if (!orderedMap.has(node)) {
            orderedMap.set(node.name, node)
        }

        for (const link of node.outgoingLinks) {
            recurse(link.targetNode)
        }
    }
}
