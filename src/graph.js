const d3 = require('d3');
const { callLinkPlugin } = require('./plugins')

/**
 * A directed acyclic graph that has been parsed from YAML.
 */
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

        return this.incomingLinks.reduce((sum, link) => {
            return sum + link.value
        }, 0)
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
}
exports.Node = Node

class Link {

    constructor({ sourceNode, targetNode, value, color, nodeLookup }) {
        this.sourceNode = sourceNode
        this.targetNode = targetNode
        this.explicitValue = value
        this.explicitColor = color
        this.nodeLookup = nodeLookup
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

        return 0
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
exports.Link = Link
