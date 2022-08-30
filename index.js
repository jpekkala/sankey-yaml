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

async function main() {
    const SHEET_FOLDER = './sheets'

    const fsPromises = require('fs').promises
    const process = require('process')
    const { Command } = require('commander')
    const program = new Command()
    program
        .name('budget')
        .description('Generates Sankey charts from YAML files')
        .argument('[in]', 'The file or folder where to read YAML from', SHEET_FOLDER)
        .parse()


    const [inputPath] = program.processedArgs

    let stat
    try {
        stat = await fsPromises.lstat(inputPath)
    } catch (err) {
        console.error(`The input path "${inputPath}" is not file or folder`)
        process.exit(1)
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
    main().catch(err => {
        console.error(err)
    })
}
