const { assert } = require('chai')
const fs = require('fs')
const mockFs = require('mock-fs')

const {
    main,
} = require('..')

const {
    OUTPUT_FOLDER,
} = require('../src/constants')

describe('index.js', function() {
    afterEach(() => {
        mockFs.restore()
    })

    it('should read a sheet from file', async () => {
        const sheet =  `
        title: MyTitle
        nodes:
            - name: Parent
              links:
                - { to: Child, value: 1000 }
        `
        mockFs({
            sheet,
        })
        await main(['node', 'index.js', 'sheet'])
        const files = fs.readdirSync(OUTPUT_FOLDER)
        assert.lengthOf(files, 1)
        assert.equal(files[0], 'MyTitle.svg')
    })

    it('should read multiple sheets from directory', async () => {
        const sheet1 =  `
        title: Sheet1
        nodes:
            - name: Parent
              links:
                - { to: Child, value: 1000 }
        `
        const sheet2 =  `
        title: Sheet2
        nodes:
            - name: Parent
              links:
                - { to: Child, value: 1000 }
        `
        mockFs({
            folder: {
                'sheet1.yaml': sheet1,
                'sheet2.yml': sheet2,
                'unrelated.txt': 'text',
            }
        })
        await main(['node', 'index.js', 'folder'])
        const files = fs.readdirSync(OUTPUT_FOLDER)
        assert.lengthOf(files, 2)
        assert.equal(files[0], 'Sheet1.svg')
        assert.equal(files[1], 'Sheet2.svg')
    })

    it('should throw if file does not exist', async () => {
        mockFs({})

        try {
            await main(['node', 'index.js', 'foobar'])
            assert.fail()
        } catch (err) {
            assert.equal(err.message, 'The path "foobar" is not file or folder')
        }
    })
})
