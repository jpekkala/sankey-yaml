require('./shims')

const { JSDOM } = require('jsdom');
const dayjs = require('dayjs');
const d3 = require('d3');
const d3Sankey = require('d3-sankey');
const fs = require('fs');

const { parseFromYamlFile } = require('./inputParser')

const hoverFormat = d3.format(",.0f");
const SHEET_FOLDER = './sheets'
const OUTPUT_FOLDER = './pics'

function main() {
    const sheetFiles = fs.readdirSync(SHEET_FOLDER).filter(fileName => fileName.endsWith('.yaml'));
    sheetFiles.forEach(fileName => generateChart(SHEET_FOLDER + '/' + fileName))
}

function generateChart(fileName) {
    const data = parseFromYamlFile(fileName)
    console.log(`Generating chart ${data.title} from ${fileName}`)

    const dom = new JSDOM('<!DOCTYPE html><body></body>');

    const body = d3.select(dom.window.document.querySelector("body"))
    const svg = body.append('svg')
        .attr('width', data.width)
        .attr('height', data.height)
        .attr('viewBox', [0, 0, data.width, data.height])
        .attr('xmlns', 'http://www.w3.org/2000/svg');

    drawDiagram(svg, data);

    // append current time
    const now = dayjs()
    svg.append('text')
        .attr('font-family', 'sans-serif')
        .attr('font-size', '8px')
        .attr('x', data.width - 5)
        .attr('y', data.height - 5)
        .attr('text-anchor', 'end')
        .text('Generated on ' + now.format('YYYY-MM-DD'))
        .append('title').text(now.format())

    if (!fs.existsSync(OUTPUT_FOLDER)) {
        fs.mkdirSync(OUTPUT_FOLDER);
    }
    const outputFile = OUTPUT_FOLDER + '/' + (data.title || 'out') + '.svg'
    fs.writeFileSync(outputFile, body.html());
    console.log(`Saved to ${outputFile}`)
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
            .text(d => {
                let text = `${d.name} ${hoverFormat(d.value)} ${data.unit}`
                if (d.description) {
                    text += `:\n${d.description}`
                }
                return text
            });

    const link = svg.append("g")
            .attr("fill", "none")
            .attr("stroke-opacity", 0.5)
        .selectAll("g")
        .data(links)
        .join("g")
            .style("mix-blend-mode", "multiply");

    link.append("path")
        .attr("d", d3Sankey.sankeyLinkHorizontal())
        .attr('stroke', d => d.color)
        .attr("stroke-width", d => Math.max(1, d.width));

    link.append("title")
        .text(d => `${d.source.name} → ${d.target.name}\n${hoverFormat(d.value)}`);

    svg.append("g")
            .attr("font-family", "sans-serif")
            .attr("font-size", 10)
        .selectAll("text")
        .data(nodes)
        .join("text")
            .attr("x", d => isTextInsideRect(d, data) ? d.x0 + (d.x0 + d.x1)/2 : d.x0 - 6)
            .attr("y", d => (d.y1 + d.y0) / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", d => isTextInsideRect(d, data) ? "middle" : "end")
            .attr('transform', d => {
                if (isTextInsideRect(d, data)) {
                    return `rotate(90 ${d.x0 + (d.x1 - d.x0)/2} ${d.y0 + (d.y1 - d.y0)/2})`
                }
            })
            .text(d => `${d.name}: ${d.value} ${data.unit}`);

    return svg.node();
}

function isTextInsideRect(d, data) {
    return d.x0 < 100
}

if (require.main === module) {
    main();
}
