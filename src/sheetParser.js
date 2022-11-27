const fsPromises = require('fs').promises
const jsYaml = require('js-yaml')
const {
    cloneDeep,
} = require('lodash')

const {
    Graph,
    Link,
    Node,
    visitNodeTree,
} = require('./graph')

const DEFAULT_WIDTH = 800
const DEFAULT_HEIGHT = 600

exports.parseSheetFile = async function(filename, options) {
    const text = await fsPromises.readFile(filename, 'utf8')
    return parseSheetAsync(text, options)
}

/**
 * Parses a string containing YAML.
 */
async function parseSheetAsync(text, options = {}) {
    const yamlSheet = jsYaml.load(text)
    const yamlNodes = yamlSheet.nodes

    if (yamlSheet.embed) {
        const {
            getSubsheet = sheetName => fsPromises.readFile(sheetName, 'utf8')
        } = options
        const subSheetNodes = await includeSubsheetsAsync({
            getSubsheet,
            yamlSheet
        })
        yamlNodes.push(...subSheetNodes)
    }

    return buildGraphs(yamlSheet, yamlNodes, options)
}
exports.parseSheetAsync = parseSheetAsync

/**
 * The same as parseSheetAsync but does not support loading subsheets synchronously (e.g. from disk)
 */
function parseSheet(text, options = {}) {
    const yamlSheet = jsYaml.load(text)
    const yamlNodes = yamlSheet.nodes

    if (yamlSheet.embed) {
        const {
            getSubsheet,
        } = options
        if (!getSubsheet) {
            throw Error('getSubsheet must be defined when embedding subsheets in sync mode')
        }
        const subSheetNodes = includeSubsheets({
            getSubsheet,
            yamlSheet
        })
        yamlNodes.push(...subSheetNodes)
    }
    return buildGraphs(yamlSheet, yamlNodes, options)
}
exports.parseSheet = parseSheet

function buildGraphs(yaml, yamlNodes, options) {
    const builder = new GraphBuilder()
    for (const nodeData of yamlNodes) {
        builder.addNodeData(nodeData)
    }
    const graphs = builder.build()

    const {
        plain = true,
    } = options

    return graphs.map(graph => ({
        title: yaml.title + graph.suffix,
        unit: yaml.unit,
        width: yaml.width || DEFAULT_WIDTH,
        height: yaml.height || DEFAULT_HEIGHT,
        nodes: graph.nodes.map(node => plain ? node.toJSON() : node),
        links: graph.links.map(link => plain ? link.toJSON() : link),
    }))
}

function parseSingleSheet(text, options) {
    const graphs = parseSheet(text, options)
    if (graphs.length > 1) {
        throw Error('Sheet contains multiple graphs')
    }
    return graphs[0]
}
exports.parseSingleSheet = parseSingleSheet

function includeSubsheets({ yamlSheet, getSubsheet }) {
    const subNodeArrays = (yamlSheet.embed || []).map(sheetName => {
        const text = getSubsheet(sheetName)
        const subsheet = jsYaml.load(text)
        const nodes = subsheet.nodes
        const subNodes = includeSubsheets({ yamlSheet: subsheet, getSubsheet })
        return [...nodes, ...subNodes]
    })
    return subNodeArrays.flat()
}

async function includeSubsheetsAsync({ yamlSheet, getSubsheet }) {
    const arrayPromises = (yamlSheet.embed || []).map(async sheetName => {
        const text = await getSubsheet(sheetName)
        const subsheet = jsYaml.load(text)
        const nodes = subsheet.nodes
        const subNodes = await includeSubsheetsAsync({ yamlSheet: subsheet, getSubsheet })
        return [...nodes, ...subNodes]
    })
    const subNodeArrays = await Promise.all(arrayPromises)
    return subNodeArrays.flat()
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
                return clone
            })

            const newCollections = []
            for (const node of alternativeNodes) {
                for (const collection of this.nodeCollections) {
                    const nodeCopy = cloneDeep(node)
                    newCollections.push(collection.cloneAndAdd(nodeCopy))
                }
            }
            this.nodeCollections = newCollections
        } else {
            for (const collection of this.nodeCollections) {
                const nodeCopy = cloneDeep(data)
                collection.add(nodeCopy)
            }
        }
    }

    build() {
        const graphs = this.nodeCollections.map(collection => collection.toGraph())
        for (const graph of graphs) {
            graph.colorNodes()
        }
        return graphs
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
        this.suffix = ''
    }

    /**
     * Mutates this instance by adding the given node data.
     */
    add(nodeData) {
        const { name } = nodeData

        if (this._map.has(name)) {
            const existing = this._map.get(name)
            const clone = cloneDeep(existing)
            if (!clone.links) {
                clone.links = []
            }
            clone.links.push(...nodeData.links || [])
            this._map.set(name, clone)
        } else {
            this._map.set(name, nodeData)
        }
    }

    clone() {
        const clone = new NodeCollection()
        for (const [key, value] of this._map.entries()) {
            clone._map.set(key, cloneDeep(value))
        }
        clone.suffix = this.suffix
        return clone
    }

    cloneAndAdd(nodeData) {
        const clone = this.clone()
        clone.add(nodeData)
        clone.suffix += '-' + nodeData.value
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
        return new Graph({
            nodes: orderedNodes,
            suffix: this.suffix,
        })
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
        visitNodeTree(node, node => {
            if (!orderedMap.has(node)) {
                orderedMap.set(node.name, node)
            }
        })
    }
    return [...orderedMap.values()]
}
