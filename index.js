const { JSDOM } = require('jsdom');
const d3 = require('d3');
const d3Sankey = require('d3-sankey');
const fs = require('fs');
const jsYaml = require('js-yaml')

const WIDTH = 800;
const HEIGHT = 800;

const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

function main() {
    const dom = new JSDOM('<!DOCTYPE html><body></body>');

    const body = d3.select(dom.window.document.querySelector("body"))
    const svg = body.append('svg')
        .attr('width', WIDTH)
        .attr('height', HEIGHT)
        .attr('viewBox', [0, 0, WIDTH, HEIGHT])
        .attr('xmlns', 'http://www.w3.org/2000/svg');

    const data = parseFromYamlFile('./data.yaml')
    drawDiagram(svg, data);

    fs.writeFileSync('out.svg', body.html());
}

function parseFromYamlFile(fileName) {
    const text = fs.readFileSync(fileName, 'utf8')
    const yamlNodes = jsYaml.load(text)
    const nodeMap = new Map(yamlNodes.map(node => [node.name, node]))
    yamlNodes.forEach(addMissingLinkTargets)
    const orderedNodes = orderNodes()
    orderedNodes.forEach(colorNode)

    const processedLinks = orderedNodes.flatMap(convertLinks)
    return {
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

    function orderNodes() {
        const orderedNames = []
        yamlNodes.forEach(recurse)
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

    function colorNode(node) {
        if (!node.color) {
            const {parent} = node
            if (parent) {
                colorNode(parent)
                node.color = parent.color
            } else {
                node.color = colorScale(node.name)
            }
        }

        if (node.color === 'random') {
            node.color = colorScale(node.name)
        }
    }

    function convertLinks(node) {
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

function sankey({ nodes, links }) {
    const sankey = d3Sankey.sankey()
        .nodeId(d => d.name)
        .nodeAlign(d3Sankey.sankeyLeft)
        .nodes(nodes)
        .links(links)
        .nodeSort(null) // null is input order, undefined is automatic
        .linkSort(null)
        .nodeWidth(15)
        .nodePadding(10)
        .extent([[1, 5], [WIDTH - 1, HEIGHT - 5]]);
    return sankey()
}

/**
 * @see https://observablehq.com/@d3/sankey-diagram
 */
function drawDiagram(svg, data) {
    const {nodes, links} = sankey(data);

    svg.append("g")
            .attr("stroke", "#000")
        .selectAll("rect")
        .data(nodes)
        .join("rect")
            .attr("x", d => d.x0)
            .attr("y", d => d.y0)
            .attr("height", d => d.y1 - d.y0)
            .attr("width", d => d.x1 - d.x0)
            .attr("fill", d => d.color)
        .append("title")
            .text(d => `${d.name}\n${format(d.value)}`);

    const link = svg.append("g")
            .attr("fill", "none")
            .attr("stroke-opacity", 0.5)
        .selectAll("g")
        .data(links)
        .join("g")
            .style("mix-blend-mode", "multiply");

    const edgeColor = 'path';

    if (edgeColor === "path") {
        const gradient = link.append("linearGradient")
            .attr("gradientUnits", "userSpaceOnUse")
            .attr("x1", d => d.source.x1)
            .attr("x2", d => d.target.x0);

        gradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", color);

        gradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", color);
    }

    link.append("path")
        .attr("d", d3Sankey.sankeyLinkHorizontal())
        .attr('stroke', d => d.color)
        .attr("stroke-width", d => Math.max(1, d.width));

    link.append("title")
        .text(d => `${d.source.name} → ${d.target.name}\n${format(d.value)}`);

    svg.append("g")
            .attr("font-family", "sans-serif")
            .attr("font-size", 10)
        .selectAll("text")
        .data(nodes)
        .join("text")
            .attr("x", d => d.x0 < WIDTH / 2 ? d.x1 + 6 : d.x0 - 6)
            .attr("y", d => (d.y1 + d.y0) / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", d => d.x0 < WIDTH / 2 ? "start" : "end")
            .text(d => d.name);

    return svg.node();
}

function color(d) {
  return colorScale(d.category === undefined ? d.name : d.category);
}

function format() {
    const format = d3.format(",.0f");
    return format;
}

if (require.main === module) {
    main();
}
