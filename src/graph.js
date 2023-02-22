const d3 = require('d3')
const { callLinkPlugin } = require('./plugins')
const {
    clone,
} = require('lodash')

/**
 * A directed acyclic graph that has been parsed from YAML.
 */
class Graph {

    constructor({ nodes, suffix}) {
        /**
         * All nodes, not just top-level nodes.
         */
        this.nodes = nodes
        this.suffix = suffix
    }

    get topLevelNodes() {
        return this.nodes.filter(node => node.incomingLinks.length === 0)
    }

    colorNodes() {
        const colorScale = d3.scaleOrdinal(d3.schemeCategory10)

        for (const node of this.nodes) {
            colorNode(node)
        }

        function colorNode(node) {
            if (node.color) {
                return
            }

            const coloredLink = node.incomingLinks.find(link => link.color)
            if (coloredLink) {
                node.color = coloredLink.color
                return
            }

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

    get links() {
        return this.nodes.flatMap(node => node.outgoingLinks)
    }

    clone() {
        const nodes = cloneNodes(this.nodes)
        return new Graph({
            nodes,
            suffix: this.suffix,
        })
    }

    translate(language, translateFn) {
        const variant = this.clone()
        for (const node of variant.nodes) {
            node.name = translateFn(node.name)
            //node.originalLinks = node.originalLinks.map(linkName => translateFn(linkName))
        }
        variant.suffix += '_' + language
        return variant
    }
}
exports.Graph = Graph

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

    addLinks(links) {
        this.originalLinks.push(...links)
    }

    get parent() {
        const link = this.incomingLinks[0]
        return link && link.sourceNode
    }

    get value() {
        if (this.explicitValue) {
            return this.explicitValue
        }

        if (this.incomingLinks.length === 0) {
            // top-level node
            return this.outgoingLinks.reduce((sum, link) => {
                return sum + link.value
            }, 0)
        } else {
            return this.incomingLinks.reduce((sum, link) => {
                return sum + link.value
            }, 0)
        }
    }

    get outgoingValue() {
        return this.outgoingLinks.reduce((sum, link) => {
            return sum + link.value
        }, 0)
    }

    toJSON() {
        return {
            name: this.name,
            description: this.description,
            color: this.color,
            value: this.value,
            /**
             * D3 overwrites the value prop with 0 if it's negative. This prop is not modified by D3.
             */
            realValue: this.value,
        }
    }

    toString() {
        return `Node[name=${this.name}]`
    }
}
exports.Node = Node

class Link {

    constructor({ sourceNode, targetNode, value, color }) {
        this.sourceNode = sourceNode
        this.targetNode = targetNode
        this.explicitValue = value
        this.explicitColor = color
    }

    get color() {
        return this.explicitColor || this.targetNode.color || this.sourceNode.color
    }

    get value() {
        if (typeof this.explicitValue === 'number') {
            return this.explicitValue
        }

        if (typeof this.explicitValue === 'object' && this.explicitValue !== null) {
            return callLinkPlugin(this, this.explicitValue)
        }

        if (typeof this.explicitValue !== 'string') {
            return 0
        }

        const stringValue = this.explicitValue.trim()

        if (stringValue === 'rest') {
            const otherLinks = this.sourceNode.outgoingLinks.filter(link => link !== this)
            const otherValue = otherLinks.reduce((sum, link) => {
                return sum + link.value
            }, 0)
            return this.sourceNode.value - otherValue
        }

        if (stringValue === 'auto') {
            return this.targetNode.outgoingValue
        }

        if (stringValue.endsWith('%')) {
            const percentage = Number(stringValue.substring(0, stringValue.length - 1))
            return Math.round(this.sourceNode.value * percentage / 100)
        }

        const parsedNumber = Number(stringValue)
        if (Number.isFinite(parsedNumber)) {
            return parsedNumber
        } else {
            return 0
        }
    }

    toJSON() {
        return {
            source: this.sourceNode.name,
            target: this.targetNode.name,
            color: this.color,
            value: this.value,
        }
    }

    toString() {
        return `Link[${this.sourceNode.name} → ${this.targetNode.name}]`
    }
}
exports.Link = Link

class Path {
    constructor() {
        this.path = []
    }

    push(node) {
        const cyclic = this.path.includes(node)
        this.path.push(node)
        if (cyclic) {
            const pathStr = this.toString()
            this.path.pop()
            throw Error(`Cyclic node: ${pathStr}`)
        }
    }

    pop() {
        return this.path.pop()
    }

    toString() {
        return this.path.map(node => node.name).join(' → ')
    }
}

/**
 * Visits each node. If there are multiple paths to a node, it is visited once for each path.
 */
function visitNodeTree(node, fn) {
    const path = new Path()
    recurse(node)

    function recurse(node) {
        path.push(node)
        fn({ node, path })
        for (const link of node.outgoingLinks) {
            recurse(link.targetNode)
        }
        path.pop()
    }
}
exports.visitNodeTree = visitNodeTree

function cloneNodes(nodes) {
    const cache = new Map()
    const path = new Path()
    return nodes.map(cloneNode)

    function cloneNode(node) {
        if (cache.has(node)) {
            return cache.get(node)
        }
        path.push(node)
        const nodeCopy = clone(node)
        cache.set(node, nodeCopy)
        nodeCopy.incomingLinks = node.incomingLinks.map(cloneLink)
        nodeCopy.outgoingLinks = node.outgoingLinks.map(cloneLink)
        path.pop()
        return nodeCopy
    }

    function cloneLink(link) {
        if (cache.has(link)) {
            return cache.get(link)
        }
        const linkCopy = clone(link)
        cache.set(link, linkCopy)
        linkCopy.sourceNode = cloneNode(linkCopy.sourceNode)
        linkCopy.targetNode = cloneNode(linkCopy.targetNode)
        return linkCopy
    }
}
