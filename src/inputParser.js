const fs = require('fs');
const jsYaml = require('js-yaml')
const d3 = require('d3');

const DEFAULT_WIDTH = 800
const DEFAULT_HEIGHT = 600

exports.parseFromYamlFile = function(fileName) {
    const text = fs.readFileSync(fileName, 'utf8')
    return parseYaml(text)
}

function parseYaml(text) {
    const yaml = jsYaml.load(text)
    const yamlNodes = yaml.nodes

    const graph = new Graph()
    yamlNodes.forEach(node => graph.addNode(node))
    graph.autovivifyNodes()
    graph.reorder()
    graph.colorNodes()

    return {
        title: yaml.title,
        unit: yaml.unit,
        width: yaml.width || DEFAULT_WIDTH,
        height: yaml.height ||DEFAULT_HEIGHT,
        nodes: graph.nodes,
        links: graph.links,
    }
}
exports.parseYaml = parseYaml

class Graph {

    constructor() {
        this.nodeMap = new Map()
    }

    addNode(node) {
        if (!(node instanceof Node)) {
            node = new Node(node)
        }
        this.nodeMap.set(node.name, node)
    }

    autovivifyNodes() {
        const missingTargets = this.nodes
            .flatMap(node => node.links)
            .map(link => link.to)
            .filter(target => !this.nodeMap.has(target))

        for (const target of new Set(missingTargets)) {
            this.addNode({
                name: target,
            })
        }
    }

    reorder() {
        const recurse = (node)  => {
            const { name } = node
            if (!map.has(name)) {
                map.set(name, node)
            }
            const children = (node.links || []).map(link => this.nodeMap.get(link.to))
            children.forEach(child => child.parent = node)
            children.forEach(recurse)
        }

        const map = new Map()
        for (const node of this.nodes) {
            recurse(node)
        }
        this.nodeMap = map
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

    get nodes() {
        return Array.from(this.nodeMap.values())
    }

    get links() {
        return this.nodes.flatMap(node => {
            return node.links.map(link => {
                const targetNode = this.nodeMap.get(link.to)
                const color = (targetNode && targetNode.color) || node.color
                return {
                    source: node.name,
                    target: link.to,
                    value: link.value,
                    color,
                }
            })
        })
    }
}

class Node {
    constructor(data) {
        this.name = data.name
        this.description = data.description
        this.color = data.color
        this.links = data.links || []
        this.explicitValue = data.value
    }

    get value() {
        if (this.explicitValue != null) {
            return this.explicitValue
        }
    }
}