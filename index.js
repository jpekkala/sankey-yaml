const fs = require('fs')
const process = require('process')

const {
    generateFromFile,
    generateFromFolder,
} = require('./src/svgDrawer')

const SHEET_FOLDER = './sheets'

const { Command } = require('commander')
const program = new Command()
program
    .name('budget')
    .description('Generates Sankey charts from YAML files')
    .argument('[in]', 'The file or folder where to read YAML from', SHEET_FOLDER)
    .parse()


const [inputPath] = program.processedArgs

if (!fs.existsSync(inputPath)) {
    console.error(`The input path "${inputPath}" is not file or folder`)
    process.exit(1)
}

const stat = fs.lstatSync(inputPath)
if (stat.isDirectory()) {
    generateFromFolder(inputPath)
} else if (stat.isFile()) {
    generateFromFile(inputPath)
} else {
    throw Error('Invalid file type')
}
