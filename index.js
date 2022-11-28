const process = require('process')
const fs = require('fs')
const { Command } = require('commander')

const {
    generateFromFile,
    generateFromFolder,
} = require('./src/svgDrawer')

const {
    registerPlugin,
} = require('./src/plugins')

exports.generateFromFile = generateFromFile
exports.generateFromFolder = generateFromFolder
exports.registerPlugin = registerPlugin
exports.main = main

async function main(argv) {
    const SHEET_FOLDER = './sheets'

    const program = new Command()
    program
        .name('budget')
        .description('Generates Sankey charts from YAML files')
        .argument('[in]', 'The file or folder where to read YAML from', SHEET_FOLDER)
        .parse(argv)

    const [inputPath] = program.processedArgs

    let stat
    try {
        stat = await fs.promises.lstat(inputPath)
    } catch (err) {
        throw Error(`The path "${inputPath}" is not file or folder`)
    }

    if (stat.isDirectory()) {
        await generateFromFolder(inputPath)
    } else if (stat.isFile()) {
        await generateFromFile(inputPath)
    } else {
        throw Error('Invalid file type')
    }
}

if (require.main === module) {
    main(process.argv).catch(err => {
        console.error(err)
        process.exit(1)
    })
}
