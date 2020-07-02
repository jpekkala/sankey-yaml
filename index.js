const { JSDOM } = require('jsdom');
const d3 = require('d3');
const d3Sankey = require('d3-sankey');
const fs = require('fs');

const { parseFromYamlFile } = require('./inputParser')

function main() {
    const dom = new JSDOM('<!DOCTYPE html><body></body>');

    const body = d3.select(dom.window.document.querySelector("body"))
    const svg = body.append('svg')
        .attr('width', data.width)
        .attr('height', data.height)
        .attr('viewBox', [0, 0, data.width, data.height])
        .attr('xmlns', 'http://www.w3.org/2000/svg');

    const data = parseFromYamlFile('./data.yaml')
    drawDiagram(svg, data);

    fs.writeFileSync('out.svg', body.html());
}

function sankey(data) {
    const sankey = d3Sankey.sankey()
        .nodeId(d => d.name)
        .nodeAlign(d3Sankey.sankeyLeft)
        .nodes(data.nodes)
        .links(data.links)
        .nodeSort(null) // null is input order, undefined is automatic
        .linkSort(null)
        .nodeWidth(15)
        .nodePadding(10)
        .extent([[1, 5], [data.width - 1, data.height - 5]]);
    return sankey()
}

/**
 * @see https://observablehq.com/@d3/sankey-diagram
 */
function drawDiagram(svg, data) {
    const {nodes, links} = sankey(data);
    console.log(nodes)

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
            .attr("stop-color", d => d.color);

        gradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", d => d.color);
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
            .attr("x", d => d.x0 < data.width / 2 ? d.x1 + 6 : d.x0 - 6)
            .attr("y", d => (d.y1 + d.y0) / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", d => d.x0 < data.width / 2 ? "start" : "end")
            .text(d => `${d.name}: ${d.value} ${data.unit}`);

    return svg.node();
}

function format() {
    const format = d3.format(",.0f");
    return format;
}

if (require.main === module) {
    main();
}
