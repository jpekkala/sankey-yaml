const { cloneDeep } = require('lodash')
const { Node, Graph, Link, visitNodeTree } = require('./graph')

class GraphBuilder {

    constructor() {
        this.nodeCollections = [new NodeCollection()]
    }

    add(data) {
        const { value } = data
        if (typeof value === 'string') {
            const values = value.split('|')
            const alternativeNodes = values.map(value => {
                const clone = cloneDeep(data)
                clone.value = value
                return clone
            })

            this.nodeCollections = alternativeNodes.flatMap(node => {
                return this.nodeCollections.map(collection => {
                    const nodeCopy = cloneDeep(node)
                    const collectionCopy = collection.clone()
                    collectionCopy.add(nodeCopy)
                    collectionCopy.suffix += '-' + nodeCopy.value
                    return collectionCopy
                })
            })
        } else {
            for (const collection of this.nodeCollections) {
                const nodeCopy = cloneDeep(data)
                collection.add(nodeCopy)
            }
        }
        return this
    }

    build() {
        const graphs = this.nodeCollections.map(collection => collection.toGraph())
        for (const graph of graphs) {
            graph.colorNodes()
        }
        return graphs
    }
}
exports.GraphBuilder = GraphBuilder

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
    const referencedNodes = new Map()
    for (const node of nodeMap.values()) {
        for (const link of node.originalLinks) {
            referencedNodes.set(link.to, link)
        }
    }

    for (const [nodeName, link] of referencedNodes.entries()) {
        if (!nodeMap.has(nodeName)) {
            nodeMap.set(nodeName, new Node({
                name: nodeName,
                description: link.description,
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
            })
            link.targetNode.incomingLinks.push(link)
            return link
        })
    }
}

function toOrderedNodeArray(nodeMap) {
    const orderedMap = new Map()
    for (const node of nodeMap.values()) {
        visitNodeTree(node, ({ node }) => {
            if (!orderedMap.has(node)) {
                orderedMap.set(node.name, node)
            }
        })
    }
    return [...orderedMap.values()]
}
