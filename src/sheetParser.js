const fsPromises = require('fs').promises
const jsYaml = require('js-yaml')

const {
    GraphBuilder,
} = require('./graphBuilder')

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
    const {
        getFile = sheetName => fsPromises.readFile(sheetName, 'utf8'),
        plain,
    } = options

    const yamlSheet = jsYaml.load(text)
    const yamlNodes = yamlSheet.nodes

    if (yamlSheet.embed) {
        const subSheetNodes = await includeSubsheetsAsync({
            getFile,
            yamlSheet
        })
        yamlNodes.push(...subSheetNodes)
    }

    let translations = []
    if (yamlSheet.translations) {
        const promises = Object.entries(yamlSheet.translations).map(async ([language, fileName]) => {
            const file = await getFile(fileName)
            const json = JSON.parse(file)
            return {
                language,
                translateFn: key => json[key] ?? key,
            }
        })
        translations = await Promise.all(promises)
    }

    return buildGraphs({
        yamlSheet,
        yamlNodes,
        plain,
        translations,
    })
}
exports.parseSheetAsync = parseSheetAsync

/**
 * The same as parseSheetAsync but does not support loading subsheets synchronously (e.g. from disk)
 */
function parseSheet(text, options = {}) {
    const {
        getFile,
        plain,
    } = options

    const yamlSheet = jsYaml.load(text)
    const yamlNodes = yamlSheet.nodes

    if (yamlSheet.embed) {
        if (!getFile) {
            throw Error('getFile must be defined when embedding subsheets in sync mode')
        }
        const subSheetNodes = includeSubsheets({
            getFile,
            yamlSheet
        })
        yamlNodes.push(...subSheetNodes)
    }

    let translations = []
    if (yamlSheet.translations) {
        if (!getFile) {
            throw Error('getFile must be define when using translations in sync mode')
        }
        translations = Object.entries(yamlSheet.translations).map(([language, fileName]) => {
            const file = getFile(fileName)
            const json = JSON.parse(file)
            return {
                language,
                translateFn: key => json[key] ?? key,
            }
        })
    }

    return buildGraphs({
        yamlSheet,
        yamlNodes,
        plain,
        translations,
    })
}
exports.parseSheet = parseSheet

function buildGraphs({ yamlSheet, yamlNodes, plain = true, translations }) {
    const builder = new GraphBuilder()
    for (const nodeData of yamlNodes) {
        builder.add(nodeData)
    }
    const graphs = builder.build()
        .flatMap(graph => {
            const variants = [graph]
            for (const { language, translateFn } of translations) {
                const variant = graph.translate(language, translateFn)
                variants.push(variant)
            }
            return variants
        })

    return graphs.map(graph => ({
        title: yamlSheet.title + graph.suffix,
        unit: yamlSheet.unit,
        width: yamlSheet.width || DEFAULT_WIDTH,
        height: yamlSheet.height || DEFAULT_HEIGHT,
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

function includeSubsheets({ yamlSheet, getFile }) {
    const subNodeArrays = (yamlSheet.embed || []).map(sheetName => {
        const text = getFile(sheetName)
        const subsheet = jsYaml.load(text)
        const nodes = subsheet.nodes
        const subNodes = includeSubsheets({ yamlSheet: subsheet, getFile })
        return [...nodes, ...subNodes]
    })
    return subNodeArrays.flat()
}

async function includeSubsheetsAsync({ yamlSheet, getFile }) {
    const arrayPromises = (yamlSheet.embed || []).map(async sheetName => {
        const text = await getFile(sheetName)
        const subsheet = jsYaml.load(text)
        const nodes = subsheet.nodes
        const subNodes = await includeSubsheetsAsync({ yamlSheet: subsheet, getFile })
        return [...nodes, ...subNodes]
    })
    const subNodeArrays = await Promise.all(arrayPromises)
    return subNodeArrays.flat()
}
