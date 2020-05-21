const { JSDOM } = require('jsdom');
const d3 = require('d3');
const d3Sankey = require('d3-sankey');
const fs = require('fs');

const WIDTH = 800;
const HEIGHT = 800;

main();

function main() {
    const dom = new JSDOM('<!DOCTYPE html><body></body>');

    const body = d3.select(dom.window.document.querySelector("body"))
    const svg = body.append('svg')
        .attr('width', WIDTH)
        .attr('height', HEIGHT)
        .attr('viewBox', [0, 0, WIDTH, HEIGHT])
        .attr('xmlns', 'http://www.w3.org/2000/svg');

    drawDiagram(svg);

    fs.writeFileSync('out.svg', body.html());
}

function readData() {
    const csv = fs.readFileSync('./data.csv', 'utf8');
    const links = d3.csvParse(csv, d3.autoType);
    const nodes = Array.from(new Set(links.flatMap(l => [l.source, l.target])), name => ({name, category: name.replace(/ .*/, "")}));
    console.log(nodes)
    return {nodes, links, units: "TWh"};
}

function sankey({ nodes, links }) {
    const sankey = d3Sankey.sankey()
        .nodeId(d => d.name)
        //.nodeAlign(d3[`sankey${align[0].toUpperCase()}${align.slice(1)}`])
        .nodes(nodes)
        .links(links)
        .nodeWidth(15)
        .nodePadding(10)
        .extent([[1, 5], [WIDTH - 1, HEIGHT - 5]]);
    return sankey()
}

function drawDiagram(svg) {
    const data = readData();

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
        .attr("fill", color)
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
            .attr("stop-color", d => color(d.source));

        gradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", d => color(d.target));
    }

    link.append("path")
        .attr("d", d3Sankey.sankeyLinkHorizontal())
        .attr("stroke", d => edgeColor === "none" ? "#aaa"
            : edgeColor === "path" ? d.uid
                : edgeColor === "input" ? color(d.source)
                    : color(d.target))
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

function color() {
  const color = d3.scaleOrdinal(d3.schemeCategory10);
  return d => color(d.category === undefined ? d.name : d.category);
}

function format() {
    const format = d3.format(",.0f");
    return format;
}
