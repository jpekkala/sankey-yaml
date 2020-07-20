const fs = require('fs');
const jsYaml = require('js-yaml')
const d3 = require('d3');

const DEFAULT_WIDTH = 800
const DEFAULT_HEIGHT = 600

exports.parseFromYamlFile = function(fileName) {
    const text = fs.readFileSync(fileName, 'utf8')
    const yaml = jsYaml.load(text)
    const yamlNodes = yaml.nodes
    const nodeMap = new Map(yamlNodes.map(node => [node.name, node]))
    yamlNodes.forEach(addMissingLinkTargets)
    const orderedNodes = orderNodes(yamlNodes, nodeMap)
    orderedNodes.forEach(nodeColorer())

    const processedLinks = []
    // flatmap
    for (const links of orderedNodes.map(linkConverter(nodeMap))) {
        processedLinks.push(...links)
    }
    return {
        title: yaml.title,
        unit: yaml.unit,
        width: yaml.width || DEFAULT_WIDTH,
        height: yaml.height ||DEFAULT_HEIGHT,
        nodes: orderedNodes,
        links: processedLinks,
    }

    function addMissingLinkTargets(node) {
        const links = node.links || []
        links.forEach(link => {
            const targetName = link.to
            if (!nodeMap.has(targetName)) {
                nodeMap.set(targetName, {
                    name: targetName,
                })
            }
        })
    }
}

function linkConverter(nodeMap) {
    return function(node) {
        return (node.links || []).map(link => {
            const targetNode = nodeMap.get(link.to)
            return {
                source: node.name,
                target: targetNode.name,
                value: link.value,
                color: targetNode.color || node.color,
            }
        })
    }
}

function orderNodes(originalNodes, nodeMap) {
    const orderedNames = []
    originalNodes.forEach(recurse)
    return orderedNames.map(name => nodeMap.get(name))

    function recurse(node) {
        const { name } = node
        if (!orderedNames.includes(name)) {
            orderedNames.push(name)
        }
        const children = (node.links || []).map(link => nodeMap.get(link.to))
        children.forEach(child => child.parent = node)
        children.forEach(recurse)
    }
}

function nodeColorer() {
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

    return function colorNode(node) {
        if (!node.color) {
            const {parent} = node
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